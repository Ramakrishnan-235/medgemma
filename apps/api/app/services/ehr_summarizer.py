import json
import uuid
from typing import Any

import httpx
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.models import EvidenceChunk, SourceFile
from app.services.embeddings import embed_query_cpu
from app.services.medgemma_adapter import VerifiedCitation


class ExtractedClinicalFact(BaseModel):
    category: str  # 'problems' | 'medications' | 'allergies' | 'timeline'
    statement: str
    status_or_severity: str | None = None
    encounter_date: str | None = None
    citation_id: str


class EHRSectionOutput(BaseModel):
    section_key: str  # 'problems' | 'medications' | 'allergies' | 'timeline'
    title: str
    missing_information: bool
    summary_markdown: str
    verified_facts: list[ExtractedClinicalFact] = Field(default_factory=list)
    citations: list[VerifiedCitation] = Field(default_factory=list)


class EHRSummaryPayload(BaseModel):
    chronological_sources: list[dict[str, Any]]
    sections: dict[str, EHRSectionOutput]
    all_citations: list[VerifiedCitation]
    limitations_note: str
    telemetry: dict[str, Any]


SECTION_QUERIES: dict[str, tuple[str, str]] = {
    "problems": (
        "Active & Historical Problems",
        "active diagnoses chronic conditions medical problems assessment history of present illness",
    ),
    "medications": (
        "Medications & Regimens",
        "current medications prescriptions dosage route frequency inpatient outpatient meds",
    ),
    "allergies": (
        "Allergies & Adverse Reactions",
        "drug allergies allergic reactions intolerances rash anaphylaxis NKDA",
    ),
    "timeline": (
        "Chronological Clinical Timeline",
        "admission discharge procedures surgeries key laboratory trends imaging findings follow-up",
    ),
}


class TwoPassEHRSummarizer:
    PROMPT_TEMPLATE_VERSION = "v2.0-two-pass-ehr-summary"

    def __init__(self, base_url: str = settings.MEDGEMMA_SERVICE_URL) -> None:
        self.base_url = base_url.rstrip("/")

    async def _retrieve_chronological_evidence(
        self,
        db: AsyncSession,
        workspace_id: uuid.UUID,
        case_id: uuid.UUID,
        selected_source_ids: list[uuid.UUID] | None = None,
        chunks_per_domain: int = 6,
    ) -> tuple[list[dict[str, Any]], dict[str, dict[str, Any]]]:
        """
        1. Loads authorized SourceFiles and orders them chronologically by encounter_date.
        2. Retrieves top-k E5-small-v2 chunks for each of the 4 clinical domains.
        """
        src_stmt = select(SourceFile).where(
            SourceFile.workspace_id == workspace_id,
            SourceFile.case_id == case_id,
            SourceFile.parse_status == "ready",
        )
        if selected_source_ids:
            src_stmt = src_stmt.where(SourceFile.id.in_(selected_source_ids))

        sources = list((await db.execute(src_stmt)).scalars().all())

        # Sort chronologically by extracted encounter_date (fallback to created_at ISO)
        sources.sort(
            key=lambda s: (
                (s.metadata_json or {}).get("encounter_date") or s.created_at.date().isoformat(),
                s.created_at.isoformat(),
            )
        )

        source_lookup = {
            s.id: {
                "source_file_id": str(s.id),
                "filename": s.filename,
                "encounter_date": (s.metadata_json or {}).get("encounter_date")
                or s.created_at.date().isoformat(),
                "file_kind": s.file_kind,
            }
            for s in sources
        }

        dedup_chunks: dict[uuid.UUID, EvidenceChunk] = {}
        authorized_ids = list(source_lookup.keys())
        if not authorized_ids:
            return [], {}

        for domain_key, (_, query_string) in SECTION_QUERIES.items():
            q_vec = embed_query_cpu(query_string)
            stmt = (
                select(EvidenceChunk)
                .where(
                    EvidenceChunk.workspace_id == workspace_id,
                    EvidenceChunk.case_id == case_id,
                    EvidenceChunk.source_file_id.in_(authorized_ids),
                )
                .order_by(EvidenceChunk.embedding.cosine_distance(q_vec))
                .limit(chunks_per_domain)
            )
            domain_rows = (await db.execute(stmt)).scalars().all()
            for row in domain_rows:
                dedup_chunks[row.id] = row

        # Order deduplicated chunks chronologically by source encounter_date, then page_or_frame
        ordered_chunks = sorted(
            dedup_chunks.values(),
            key=lambda c: (
                source_lookup[c.source_file_id]["encounter_date"],
                c.page_or_frame,
            ),
        )

        allowed_chunks: dict[str, dict[str, Any]] = {}
        for idx, chunk in enumerate(ordered_chunks[:20], start=1):
            cit_key = f"cit_{idx}"
            src_info = source_lookup[chunk.source_file_id]
            allowed_chunks[cit_key] = {
                "id": chunk.id,
                "source_file_id": chunk.source_file_id,
                "filename": src_info["filename"],
                "encounter_date": src_info["encounter_date"],
                "page_or_frame": chunk.page_or_frame,
                "bbox_norm": chunk.bbox_norm,
                "section_type": chunk.section_type,
                "content_text": chunk.content_text,
            }

        return list(source_lookup.values()), allowed_chunks

    async def _call_medgemma_json(
        self, system_instruction: str, user_prompt: str, max_new_tokens: int = 1024
    ) -> tuple[dict[str, Any], dict[str, Any]]:
        async with httpx.AsyncClient(timeout=150.0) as client:
            resp = await client.post(
                f"{self.base_url}/v1/generate",
                json={
                    "system_instruction": system_instruction,
                    "user_prompt": user_prompt,
                    "images": [],
                    "max_new_tokens": max_new_tokens,
                },
            )
            resp.raise_for_status()
            data = resp.json()

        raw = data["generated_text"].strip()
        # Strip optional markdown code fences if the model wrapped JSON
        if raw.startswith("```"):
            raw = raw.strip("`").removeprefix("json").strip()

        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            parsed = {}

        telemetry = {
            "model_checkpoint": data["model_checkpoint"],
            "processor_version": data["processor_version"],
            "execution_mode": data["execution_mode"],
            "queue_wait_ms": data["queue_wait_ms"],
            "inference_ms": data["inference_ms"],
            "input_token_count": data["input_token_count"],
            "output_token_count": data["output_token_count"],
        }
        return parsed, telemetry

    async def execute_two_pass_summary(
        self,
        db: AsyncSession,
        workspace_id: uuid.UUID,
        case_id: uuid.UUID,
        selected_source_ids: list[uuid.UUID] | None = None,
    ) -> EHRSummaryPayload:
        chronological_sources, allowed_chunks = await self._retrieve_chronological_evidence(
            db=db,
            workspace_id=workspace_id,
            case_id=case_id,
            selected_source_ids=selected_source_ids,
        )

        if not allowed_chunks:
            empty_sections = {
                key: EHRSectionOutput(
                    section_key=key,
                    title=title,
                    missing_information=True,
                    summary_markdown="No documented evidence in selected sources.",
                )
                for key, (title, _) in SECTION_QUERIES.items()
            }
            return EHRSummaryPayload(
                chronological_sources=chronological_sources,
                sections=empty_sections,
                all_citations=[],
                limitations_note="No parsed evidence chunks available in selected sources.",
                telemetry={"prompt_template_version": self.PROMPT_TEMPLATE_VERSION},
            )

        context_block = "\n".join(
            f"[{cit_key}] (date={m['encounter_date']}, file={m['filename']}, page={m['page_or_frame']}, section={m['section_type']}): {m['content_text']}"
            for cit_key, m in allowed_chunks.items()
        )

        # -------------------------------------------------------------------------
        # PASS 1: Atomic Fact Extraction with Mandatory Citation Keys
        # -------------------------------------------------------------------------
        pass1_system = (
            "You are a clinical data extractor powered by MedGemma 1.5. "
            "Extract ONLY explicitly stated clinical facts from the provided chronological evidence passages. "
            "Every extracted fact MUST reference its exact bracketed source key (e.g. 'cit_1'). "
            "Do NOT infer or guess missing conditions, medications, or allergies. "
            "Return strict JSON with key 'facts' containing a list of objects: "
            '{"category": "problems"|"medications"|"allergies"|"timeline", '
            '"statement": str, "status_or_severity": str|null, "encounter_date": str|null, "citation_id": str}.'
        )
        pass1_prompt = f"CHRONOLOGICAL EVIDENCE PASSAGES:\n{context_block}"
        pass1_json, telemetry_1 = await self._call_medgemma_json(
            system_instruction=pass1_system,
            user_prompt=pass1_prompt,
            max_new_tokens=1024,
        )

        # Deterministic Citation Gate: keep ONLY facts whose citation_id resolves to allowed_chunks
        verified_by_section: dict[str, list[ExtractedClinicalFact]] = {
            k: [] for k in SECTION_QUERIES
        }
        used_citation_keys: set[str] = set()

        for raw_fact in pass1_json.get("facts", []):
            if not isinstance(raw_fact, dict):
                continue
            cat = str(raw_fact.get("category", "")).lower().strip()
            cit_id = str(raw_fact.get("citation_id", "")).strip("[] ")
            stmt_text = str(raw_fact.get("statement", "")).strip()

            if cat in verified_by_section and cit_id in allowed_chunks and stmt_text:
                chunk_meta = allowed_chunks[cit_id]
                fact = ExtractedClinicalFact(
                    category=cat,
                    statement=stmt_text,
                    status_or_severity=raw_fact.get("status_or_severity"),
                    encounter_date=raw_fact.get("encounter_date") or chunk_meta["encounter_date"],
                    citation_id=cit_id,
                )
                verified_by_section[cat].append(fact)
                used_citation_keys.add(cit_id)

        # -------------------------------------------------------------------------
        # PASS 2: Section Synthesis + Deterministic Missing-Information State
        # -------------------------------------------------------------------------
        non_empty_categories = {k: v for k, v in verified_by_section.items() if v}
        pass2_summaries: dict[str, str] = {}
        telemetry_2: dict[str, Any] = {}

        if non_empty_categories:
            pass2_system = (
                "You are a clinical summarization assistant powered by MedGemma 1.5. "
                "Synthesize concise markdown bullet points for each provided category using ONLY the verified facts. "
                "Preserve every inline citation marker in brackets like [cit_1]. "
                "Return strict JSON mapping each category key to its markdown string."
            )
            verified_facts_dump = json.dumps(
                {k: [f.model_dump() for f in v] for k, v in non_empty_categories.items()},
                indent=2,
            )
            pass2_json, telemetry_2 = await self._call_medgemma_json(
                system_instruction=pass2_system,
                user_prompt=f"VERIFIED CLINICAL FACTS:\n{verified_facts_dump}",
                max_new_tokens=896,
            )
            if isinstance(pass2_json, dict):
                pass2_summaries = {str(k): str(v) for k, v in pass2_json.items()}

        sections_output: dict[str, EHRSectionOutput] = {}
        all_verified_citations_map: dict[str, VerifiedCitation] = {}

        for sec_key, (sec_title, _) in SECTION_QUERIES.items():
            sec_facts = verified_by_section[sec_key]
            if not sec_facts:
                # Explicit Missing-Information State
                sections_output[sec_key] = EHRSectionOutput(
                    section_key=sec_key,
                    title=sec_title,
                    missing_information=True,
                    summary_markdown="No documented evidence in selected sources.",
                    verified_facts=[],
                    citations=[],
                )
                continue

            # Deterministic fallback markdown if Pass 2 omitted a key or dropped citations
            synthesized_md = pass2_summaries.get(sec_key, "").strip()
            if not synthesized_md or not any(f"[{f.citation_id}]" in synthesized_md for f in sec_facts):
                synthesized_md = "\n".join(
                    f"- **{f.encounter_date or 'Undated'}**: {f.statement}"
                    + (f" ({f.status_or_severity})" if f.status_or_severity else "")
                    + f" [{f.citation_id}]"
                    for f in sec_facts
                )

            sec_citations: list[VerifiedCitation] = []
            seen_sec_cits: set[str] = set()
            for f in sec_facts:
                if f.citation_id not in seen_sec_cits and f.citation_id in allowed_chunks:
                    c_meta = allowed_chunks[f.citation_id]
                    vc = VerifiedCitation(
                        citation_id=f.citation_id,
                        evidence_chunk_id=c_meta["id"],
                        source_file_id=c_meta["source_file_id"],
                        page_or_frame=c_meta["page_or_frame"],
                        bbox_norm=c_meta["bbox_norm"],
                        verbatim_quote=c_meta["content_text"][:240],
                    )
                    sec_citations.append(vc)
                    all_verified_citations_map[f.citation_id] = vc
                    seen_sec_cits.add(f.citation_id)

            sections_output[sec_key] = EHRSectionOutput(
                section_key=sec_key,
                title=sec_title,
                missing_information=False,
                summary_markdown=synthesized_md,
                verified_facts=sec_facts,
                citations=sec_citations,
            )

        combined_telemetry = {
            "prompt_template_version": self.PROMPT_TEMPLATE_VERSION,
            "pass1": telemetry_1,
            "pass2": telemetry_2,
            "verified_fact_count": sum(len(v) for v in verified_by_section.values()),
            "verified_citation_count": len(all_verified_citations_map),
        }

        return EHRSummaryPayload(
            chronological_sources=chronological_sources,
            sections=sections_output,
            all_citations=list(all_verified_citations_map.values()),
            limitations_note=(
                "Generated for clinical research and reviewer workflow only. "
                "Verify all extracted problems, medications, and allergies against linked source highlights."
            ),
            telemetry=combined_telemetry,
        )
