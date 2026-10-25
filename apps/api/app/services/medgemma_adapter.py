import json
from typing import Any, Optional
import uuid
import httpx
from pydantic import BaseModel, Field

from app.core.config import settings


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

        if self._client is not None:
            resp = await self._client.post(f"{self.base_url}/v1/generate", json=request_payload)
            resp.raise_for_status()
            gpu_data = resp.json()
        else:
            async with httpx.AsyncClient(timeout=120.0) as client:
                resp = await client.post(f"{self.base_url}/v1/generate", json=request_payload)
                resp.raise_for_status()
                gpu_data = resp.json()

        raw_text = gpu_data.get("generated_text") or gpu_data.get("text") or ""
        try:
            parsed = json.loads(raw_text)
            if not isinstance(parsed, dict):
                raise ValueError("Expected dictionary from JSON response")
        except (json.JSONDecodeError, ValueError):
            parsed = {
                "answer_markdown": raw_text,
                "cited_keys": [k for k in allowed_chunks if f"[{k}]" in raw_text],
                "limitations_note": "Output required fallback JSON wrapping; verify against source.",
            }

        # Deterministic Citation Resolution: reject any citation key not in allowed_chunks
        verified_citations: list[VerifiedCitation] = []
        for key in parsed.get("cited_keys", []):
            if key in allowed_chunks:
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
                except (ValueError, KeyError):
                    continue

        return GroundedGenerationOutput(
            answer_markdown=str(parsed.get("answer_markdown", "")),
            citations=verified_citations,
            limitations_note=str(parsed.get(
                "limitations_note",
                "For research and reviewer workflow only. Requires clinical validation.",
            )),
            telemetry={
                "model_checkpoint": gpu_data.get("model_checkpoint", settings.MEDGEMMA_CHECKPOINT),
                "processor_version": gpu_data.get("processor_version", settings.MEDGEMMA_PROCESSOR_VERSION),
                "prompt_template_version": self.PROMPT_TEMPLATE_VERSION,
                "execution_mode": gpu_data.get("execution_mode", settings.MEDGEMMA_MODE),
                "queue_wait_ms": gpu_data.get("queue_wait_ms", 0),
                "inference_ms": gpu_data.get("inference_ms", 0),
                "input_token_count": gpu_data.get("input_token_count", 0),
                "output_token_count": gpu_data.get("output_token_count", 0),
            },
        )
