import asyncio
import base64
import os
import uuid
from typing import Any, Optional

import httpx
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.storage import storage_adapter
from app.db.models import EvidenceChunk, ImageAnnotation, SourceFile
from app.services.dicom_xray_pipeline import (
    ChestXrayPreprocessor,
    map_medgemma_box_to_source_norm,
)
from app.services.medgemma_adapter import VerifiedCitation
from app.services.generation import (
    generated_text, generation_telemetry, parse_generated_object, request_generation,
)

FEATURE_MODEL_LOCALIZATION_BOXES = (
    os.getenv("FEATURE_MODEL_LOCALIZATION_BOXES", "false").lower() == "true"
)


class XrayObservationSection(BaseModel):
    anatomical_region: str  # lungs_airways | pleura | cardiomediastinal | tubes_lines | musculoskeletal
    observation: str
    abnormality_present: bool = False
    box_2d_1000: list[float] | None = None  # Optional [ymin, xmin, ymax, xmax] in [0..1000]


class SingleXrayAnalysisPayload(BaseModel):
    source_file_id: uuid.UUID
    view_position: str
    study_date: str | None
    findings_by_region: list[XrayObservationSection]
    impression_markdown: str
    citations: list[VerifiedCitation]
    model_boxes_enabled: bool
    saved_annotation_ids: list[uuid.UUID] = Field(default_factory=list)
    limitations_note: str
    telemetry: dict[str, Any]


class LongitudinalIntervalChange(BaseModel):
    anatomical_region: str
    change_status: str  # new | worsened | improved | resolved | stable
    description: str
    citations: list[str]  # ["cit_prior", "cit_current"]


class LongitudinalXrayPayload(BaseModel):
    prior_source_file_id: uuid.UUID
    current_source_file_id: uuid.UUID
    prior_study_date: str | None
    current_study_date: str | None
    projection_warning: str | None
    interval_changes: list[LongitudinalIntervalChange]
    comparison_summary_markdown: str
    citations: list[VerifiedCitation]
    limitations_note: str
    telemetry: dict[str, Any]


class ChestXrayAnalysisService:
    SINGLE_PROMPT_VERSION = "v1.0-cxr-structured-single"
    LONGITUDINAL_PROMPT_VERSION = "v1.0-cxr-longitudinal-pair"

    def __init__(
        self,
        base_url: str = settings.MEDGEMMA_SERVICE_URL,
        client: Optional[httpx.AsyncClient] = None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self._client = client

    def _load_medgemma_896_b64(self, source: SourceFile) -> str:
        key_896 = source.metadata_json.get("medgemma_896_key")
        if not key_896:
            # Fallback: if raw storage_key exists, preprocess on the fly
            try:
                raw_bytes = storage_adapter.get_object_bytes(source.storage_key)
                preprocessor = ChestXrayPreprocessor()
                if source.file_kind == "dicom" or source.filename.lower().endswith(".dcm"):
                    normalized = preprocessor.normalize_dicom_bytes(raw_bytes)
                else:
                    normalized = preprocessor.normalize_standard_image_bytes(raw_bytes)
                return normalized.medgemma_896_b64
            except Exception:
                raise ValueError(f"SourceFile {source.id} has not been normalized for 896x896 X-ray inference.")
        raw_png = storage_adapter.get_object_bytes(key_896)
        return base64.b64encode(raw_png).decode("ascii")

    async def _get_or_create_image_chunk(
        self, db: AsyncSession, source: SourceFile
    ) -> EvidenceChunk:
        stmt = select(EvidenceChunk).where(
            EvidenceChunk.source_file_id == source.id,
            EvidenceChunk.case_id == source.case_id,
            EvidenceChunk.workspace_id == source.workspace_id,
        )
        chunk = (await db.execute(stmt)).scalars().first()
        if chunk is None:
            from app.services.embeddings import E5_MODEL_NAME, embed_passages_cpu
            view_pos = source.metadata_json.get("view_position", "UNKNOWN")
            study_date = source.metadata_json.get("encounter_date")
            content_text = f"Chest X-Ray ({view_pos}, {study_date or 'Undated'}): {source.filename}"
            embedding = (await asyncio.to_thread(embed_passages_cpu, [content_text]))[0]
            chunk = EvidenceChunk(
                workspace_id=source.workspace_id,
                case_id=source.case_id,
                source_file_id=source.id,
                page_or_frame=1,
                bbox_norm={"x0": 0.0, "y0": 0.0, "x1": 1.0, "y1": 1.0},
                section_type="imaging_metadata",
                content_text=content_text,
                embedding=embedding,
                embedding_model=E5_MODEL_NAME,
            )
            db.add(chunk)
            await db.flush()
        return chunk

    async def execute_single_xray_analysis(
        self,
        db: AsyncSession,
        workspace_id: uuid.UUID,
        case_id: uuid.UUID,
        source_file_id: uuid.UUID,
        user_id: uuid.UUID,
        clinical_indication: str = "Routine chest radiograph evaluation.",
        ai_run_id: uuid.UUID | None = None,
    ) -> SingleXrayAnalysisPayload:
        stmt = select(SourceFile).where(
            SourceFile.id == source_file_id,
            SourceFile.case_id == case_id,
            SourceFile.workspace_id == workspace_id,
        )
        source = (await db.execute(stmt)).scalar_one_or_none()
        if source is None:
            raise ValueError("Authorized Chest X-ray source file not found.")

        img_b64 = await asyncio.to_thread(self._load_medgemma_896_b64, source)
        img_chunk = await self._get_or_create_image_chunk(db, source)
        view_pos = source.metadata_json.get("view_position", "UNKNOWN")
        study_date = source.metadata_json.get("encounter_date")

        system_instruction = (
            "You are a radiology research assistant powered by MedGemma 1.5. "
            "Analyze the provided Chest X-ray image systematically across 5 regions: "
            "lungs_airways, pleura, cardiomediastinal, tubes_lines, and musculoskeletal. "
            "Every finding must cite [cit_img_1]. "
            "If an abnormality is focal and localizable, include 'box_2d_1000' as [ymin, xmin, ymax, xmax] "
            "scaled 0..1000; otherwise set 'box_2d_1000' to null. "
            "Respond strictly in JSON with keys: 'findings_by_region' (list) and 'impression_markdown' (str)."
        )
        user_prompt = (
            f"STUDY METADATA: ViewPosition={view_pos}, StudyDate={study_date or 'Undated'}, "
            f"CitationKey=[cit_img_1]\n"
            f"CLINICAL INDICATION: {clinical_indication}"
        )

        request_payload = {
            "system_instruction": system_instruction,
            "user_prompt": user_prompt,
            "images": [{"image_id": str(source.id), "base64_png": img_b64}],
            "max_new_tokens": 896,
        }

        gpu_data = await request_generation(self.base_url, request_payload, client=self._client)
        raw = generated_text(gpu_data)
        parsed = parse_generated_object(raw)
        if parsed is None:
            parsed = {
                "findings_by_region": [
                    {
                        "anatomical_region": "general",
                        "observation": raw,
                        "abnormality_present": False,
                        "box_2d_1000": None,
                    }
                ],
                "impression_markdown": f"{raw} [cit_img_1]",
            }

        findings: list[XrayObservationSection] = []
        saved_annotation_ids: list[uuid.UUID] = []
        letterbox_tf = source.metadata_json.get("letterbox_transform", {})

        for item in parsed.get("findings_by_region", []):
            if not isinstance(item, dict):
                continue
            obs = XrayObservationSection(
                anatomical_region=str(item.get("anatomical_region", "lungs_airways")),
                observation=str(item.get("observation", "")),
                abnormality_present=bool(item.get("abnormality_present", False)),
                box_2d_1000=item.get("box_2d_1000"),
            )
            findings.append(obs)

            # Map 896x896 model coordinates back to original X-ray if feature flag enabled
            if (
                FEATURE_MODEL_LOCALIZATION_BOXES
                and obs.abnormality_present
                and obs.box_2d_1000
                and letterbox_tf
            ):
                mapped_bbox = map_medgemma_box_to_source_norm(obs.box_2d_1000, letterbox_tf)
                if mapped_bbox:
                    ann_id = uuid.uuid4()
                    db.add(
                        ImageAnnotation(
                            id=ann_id,
                            workspace_id=workspace_id,
                            case_id=case_id,
                            source_file_id=source.id,
                            ai_run_id=ai_run_id,
                            frame_index=1,
                            origin="model_medgemma",
                            anatomical_label=obs.anatomical_region,
                            finding_text=obs.observation,
                            bbox_norm=mapped_bbox,
                            review_state="pending_review",
                            created_by=user_id,
                        )
                    )
                    saved_annotation_ids.append(ann_id)

        impression_md = str(parsed.get("impression_markdown", "")).strip()
        if "[cit_img_1]" not in impression_md:
            impression_md = f"{impression_md} [cit_img_1]".strip()

        verified_cit = VerifiedCitation(
            citation_id="cit_img_1",
            evidence_chunk_id=img_chunk.id,
            source_file_id=source.id,
            page_or_frame=1,
            bbox_norm={"x0": 0.0, "y0": 0.0, "x1": 1.0, "y1": 1.0},
            verbatim_quote=f"Chest X-Ray ({view_pos}, {study_date or 'Undated'}): {source.filename}",
        )

        return SingleXrayAnalysisPayload(
            source_file_id=source.id,
            view_position=view_pos,
            study_date=study_date,
            findings_by_region=findings,
            impression_markdown=impression_md,
            citations=[verified_cit],
            model_boxes_enabled=FEATURE_MODEL_LOCALIZATION_BOXES,
            saved_annotation_ids=saved_annotation_ids,
            limitations_note=(
                "Research reviewer draft only. Base MedGemma 1.5 outputs and localization boxes "
                "require qualified clinician verification before clinical use."
            ),
            telemetry=generation_telemetry(gpu_data, self.SINGLE_PROMPT_VERSION),
        )

    async def execute_longitudinal_comparison(
        self,
        db: AsyncSession,
        workspace_id: uuid.UUID,
        case_id: uuid.UUID,
        prior_source_file_id: uuid.UUID,
        current_source_file_id: uuid.UUID,
        clinical_question: str = "Evaluate interval change between prior and current chest radiographs.",
    ) -> LongitudinalXrayPayload:
        stmt = select(SourceFile).where(
            SourceFile.case_id == case_id,
            SourceFile.workspace_id == workspace_id,
            SourceFile.id.in_([prior_source_file_id, current_source_file_id]),
        )
        rows = {s.id: s for s in (await db.execute(stmt)).scalars().all()}
        if prior_source_file_id not in rows or current_source_file_id not in rows:
            raise ValueError("Both Prior and Current X-ray sources must belong to this case.")

        prior_src = rows[prior_source_file_id]
        curr_src = rows[current_source_file_id]

        prior_b64, curr_b64 = await asyncio.gather(
            asyncio.to_thread(self._load_medgemma_896_b64, prior_src),
            asyncio.to_thread(self._load_medgemma_896_b64, curr_src),
        )

        prior_chunk = await self._get_or_create_image_chunk(db, prior_src)
        curr_chunk = await self._get_or_create_image_chunk(db, curr_src)

        prior_view = prior_src.metadata_json.get("view_position", "UNKNOWN")
        curr_view = curr_src.metadata_json.get("view_position", "UNKNOWN")
        prior_date = prior_src.metadata_json.get("encounter_date")
        curr_date = curr_src.metadata_json.get("encounter_date")

        projection_warning: str | None = None
        if prior_view != curr_view and "UNKNOWN" not in (prior_view, curr_view):
            projection_warning = (
                f"Projection difference detected: Prior is {prior_view} whereas Current is {curr_view}. "
                "Assess apparent cardiomediastinal silhouette and lung volume changes with caution."
            )

        system_instruction = (
            "You are a radiology research assistant powered by MedGemma 1.5. "
            "Image 1 is the PRIOR Chest X-ray [cit_prior]. Image 2 is the CURRENT Chest X-ray [cit_current]. "
            "Compare them systematically and report interval changes across lungs_airways, pleura, "
            "cardiomediastinal, and tubes_lines. Cite both [cit_prior] and [cit_current] when describing interval change. "
            "Respond strictly in JSON with keys: 'interval_changes' (list of objects with "
            "'anatomical_region', 'change_status', 'description', 'citations') and 'comparison_summary_markdown' (str)."
        )
        user_prompt = (
            f"PRIOR STUDY [cit_prior]: date={prior_date or 'Undated'}, view={prior_view}\n"
            f"CURRENT STUDY [cit_current]: date={curr_date or 'Undated'}, view={curr_view}\n"
            f"PROJECTION NOTE: {projection_warning or 'Matching views'}\n"
            f"CLINICAL FOCUS: {clinical_question}"
        )

        request_payload = {
            "system_instruction": system_instruction,
            "user_prompt": user_prompt,
            "images": [
                {"image_id": str(prior_src.id), "base64_png": prior_b64},
                {"image_id": str(curr_src.id), "base64_png": curr_b64},
            ],
            "max_new_tokens": 1024,
        }

        gpu_data = await request_generation(
            self.base_url, request_payload, client=self._client, timeout=150.0,
        )
        raw = generated_text(gpu_data)
        parsed = parse_generated_object(raw)
        if parsed is None:
            parsed = {
                "interval_changes": [],
                "comparison_summary_markdown": f"{raw} [cit_prior] [cit_current]",
            }

        changes: list[LongitudinalIntervalChange] = []
        for item in parsed.get("interval_changes", []):
            if isinstance(item, dict):
                changes.append(
                    LongitudinalIntervalChange(
                        anatomical_region=str(item.get("anatomical_region", "lungs_airways")),
                        change_status=str(item.get("change_status", "stable")),
                        description=str(item.get("description", "")),
                        citations=["cit_prior", "cit_current"],
                    )
                )

        summary_md = str(parsed.get("comparison_summary_markdown", "")).strip()
        if "[cit_prior]" not in summary_md or "[cit_current]" not in summary_md:
            summary_md = f"{summary_md} [cit_prior] [cit_current]".strip()

        verified_citations = [
            VerifiedCitation(
                citation_id="cit_prior",
                evidence_chunk_id=prior_chunk.id,
                source_file_id=prior_src.id,
                page_or_frame=1,
                bbox_norm={"x0": 0.0, "y0": 0.0, "x1": 1.0, "y1": 1.0},
                verbatim_quote=f"Prior Chest X-Ray ({prior_date or 'Undated'}, {prior_view}): {prior_src.filename}",
            ),
            VerifiedCitation(
                citation_id="cit_current",
                evidence_chunk_id=curr_chunk.id,
                source_file_id=curr_src.id,
                page_or_frame=1,
                bbox_norm={"x0": 0.0, "y0": 0.0, "x1": 1.0, "y1": 1.0},
                verbatim_quote=f"Current Chest X-Ray ({curr_date or 'Undated'}, {curr_view}): {curr_src.filename}",
            ),
        ]

        return LongitudinalXrayPayload(
            prior_source_file_id=prior_src.id,
            current_source_file_id=curr_src.id,
            prior_study_date=prior_date,
            current_study_date=curr_date,
            projection_warning=projection_warning,
            interval_changes=changes,
            comparison_summary_markdown=summary_md,
            citations=verified_citations,
            limitations_note=(
                "Longitudinal descriptive draft for reviewer workflow only. "
                "Does not perform deformable registration or automated quantitative mensuration."
            ),
            telemetry=generation_telemetry(gpu_data, self.LONGITUDINAL_PROMPT_VERSION),
        )
