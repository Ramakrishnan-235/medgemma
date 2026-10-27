from typing import Any, Optional
import uuid
import httpx
from pydantic import BaseModel, Field

from app.core.config import settings
from app.services.generation import (
    generated_text, generation_telemetry, parse_generated_object, request_generation,
)


class VerifiedCitation(BaseModel):
    citation_id: str
    evidence_chunk_id: uuid.UUID
    source_file_id: uuid.UUID
    page_or_frame: int
    bbox_norm: dict[str, float] | None = None
    verbatim_quote: str


class GroundedGenerationOutput(BaseModel):
    answer_markdown: str
    citations: list[VerifiedCitation] = Field(default_factory=list)
    limitations_note: str
    telemetry: dict[str, Any]


class MedGemmaAdapter:
    """
    Single boundary between Celery workers and the MedGemma GPU service.
    Validates that every cited chunk ID belongs to the authorized case_id.
    """

    PROMPT_TEMPLATE_VERSION = "v1.0-grounded-clinical-json"

    def __init__(
        self,
        base_url: str = settings.MEDGEMMA_SERVICE_URL,
        client: Optional[httpx.AsyncClient] = None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self._client = client

    async def generate_grounded_answer(
        self,
        question: str,
        allowed_chunks: dict[str, dict[str, Any]],  # keyed by cit_1, cit_2 -> chunk metadata
        images_b64: list[dict[str, str]] | None = None,
    ) -> GroundedGenerationOutput:
        context_lines = [
            f"[{cit_key}] (source={meta.get('source_file_id')}, page={meta.get('page_or_frame', 1)}): {meta.get('content_text', '')}"
            for cit_key, meta in allowed_chunks.items()
        ]
        system_instruction = (
            "You are a clinical research assistant powered by MedGemma 1.5. "
            "Answer ONLY using the provided evidence passages and images. "
            "Every factual statement MUST cite its bracketed key (e.g., [cit_1]). "
            "Respond strictly in JSON with keys: answer_markdown, cited_keys (list of strings), limitations_note."
        )
        user_prompt = (
            f"EVIDENCE PASSAGES:\n" + "\n".join(context_lines) +
            f"\n\nCLINICAL QUESTION:\n{question}"
        )

        request_payload = {
            "system_instruction": system_instruction,
            "user_prompt": user_prompt,
            "images": images_b64 or [],
            "max_new_tokens": 768,
        }

        gpu_data = await request_generation(self.base_url, request_payload, client=self._client)
        raw_text = generated_text(gpu_data)
        parsed = parse_generated_object(raw_text)
        if parsed is None:
            parsed = {
                "answer_markdown": raw_text,
                "cited_keys": [k for k in allowed_chunks if f"[{k}]" in raw_text],
                "limitations_note": "Output required fallback JSON wrapping; verify against source.",
            }

        # Deterministic Citation Resolution: reject any citation key not in allowed_chunks
        verified_citations: list[VerifiedCitation] = []
        cited_keys = parsed.get("cited_keys", [])
        if not isinstance(cited_keys, list):
            cited_keys = []
        seen_keys: set[str] = set()
        for key in cited_keys:
            if isinstance(key, str) and key in allowed_chunks and key not in seen_keys:
                chunk = allowed_chunks[key]
                try:
                    verified_citations.append(
                        VerifiedCitation(
                            citation_id=str(key),
                            evidence_chunk_id=uuid.UUID(str(chunk["id"])),
                            source_file_id=uuid.UUID(str(chunk["source_file_id"])),
                            page_or_frame=int(chunk.get("page_or_frame", 1)),
                            bbox_norm=chunk.get("bbox_norm"),
                            verbatim_quote=str(chunk.get("content_text", ""))[:240],
                        )
                    )
                    seen_keys.add(key)
                except (ValueError, KeyError, TypeError):
                    continue

        return GroundedGenerationOutput(
            answer_markdown=str(parsed.get("answer_markdown", "")),
            citations=verified_citations,
            limitations_note=str(parsed.get(
                "limitations_note",
                "For research and reviewer workflow only. Requires clinical validation.",
            )),
            telemetry=generation_telemetry(gpu_data, self.PROMPT_TEMPLATE_VERSION),
        )
