import asyncio
import os
import time
from typing import Any, AsyncGenerator, Dict, List, Optional
from openai import AsyncOpenAI

MODEL_ID = os.getenv("MEDGEMMA_MODEL_ID", "google/medgemma-1.5-4b-it")
VLLM_BASE_URL = os.getenv("MEDGEMMA_BASE_URL", "http://localhost:8000/v1")


class MedGemmaVQASessionManager:
    """
    Manages stateful multi-turn interactive VQA sessions for CT studies.
    Maintains the warm shared vision prefix across conversation turns so
    subsequent clinician questions achieve sub-150ms Time-To-First-Token (TTFT)
    via vLLM Automatic Prefix Caching (APC).
    """

    def __init__(self, base_url: str = VLLM_BASE_URL, api_key: str = "EMPTY"):
        self.base_url = base_url
        self.api_key = api_key
        self._client: Optional[AsyncOpenAI] = None
        self.study_cache: Dict[str, Dict[str, Any]] = {}

    def get_client(self) -> AsyncOpenAI:
        if self._client is None:
            self._client = AsyncOpenAI(base_url=self.base_url, api_key=self.api_key)
        return self._client

    def register_study_prefix(
        self,
        study_id: str,
        base64_slices: List[str],
        system_prompt: Optional[str] = None,
    ) -> None:
        """Initializes a study session with its shared vision prefix."""
        system_instruction = system_prompt or (
            "You are MedGemma 1.5, an expert clinical radiological reasoning system. "
            "Analyze the attached chest CT series and answer the clinician's targeted questions "
            "with precise anatomical location, tissue attenuation (HU), dimensions, and Lung-RADS v2022 context."
        )

        shared_vision_prefix = [
            {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}"}}
            for b64 in base64_slices
        ]

        messages: List[Dict[str, Any]] = [
            {
                "role": "user",
                "content": shared_vision_prefix + [
                    {"type": "text", "text": f"{system_instruction}\nStudy ID: {study_id} initialized."}
                ],
            },
            {
                "role": "assistant",
                "content": f"Study {study_id} volume resident in cache. Ready for targeted clinical queries.",
            },
        ]

        self.study_cache[study_id] = {
            "study_id": study_id,
            "created_at": time.time(),
            "last_active": time.time(),
            "messages": messages,
            "slice_count": len(base64_slices),
        }

    def has_study(self, study_id: str) -> bool:
        return study_id in self.study_cache

    def get_session(self, study_id: str) -> Dict[str, Any]:
        if study_id not in self.study_cache:
            raise KeyError(f"Study session '{study_id}' not found in warm prefix cache.")
        return self.study_cache[study_id]

    def clear_session(self, study_id: str) -> bool:
        return self.study_cache.pop(study_id, None) is not None

    async def stream_question(
        self,
        study_id: str,
        question: str,
        client: Optional[AsyncOpenAI] = None,
        mock_mode: bool = False,
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Appends user question to the warm session and streams the answer chunks.
        Reuses warm KV-cache blocks without re-encoding the 3D volume.
        """
        if study_id not in self.study_cache:
            raise KeyError(f"Study '{study_id}' must be registered before initiating VQA stream.")

        session = self.study_cache[study_id]
        session["last_active"] = time.time()
        session["messages"].append({"role": "user", "content": question})

        if mock_mode or (client is None and not os.getenv("MEDGEMMA_LIVE_VLLM")):
            # Deterministic mock responses for tests and offline environments
            mock_tokens = [
                "Based on the ",
                "3-channel radiologic HU mapping ",
                "(Lung and Soft Tissue windows), ",
                "there is a well-circumscribed ",
                "9.5 mm solid pulmonary nodule ",
                "located in the right lower lobe ",
                "(Axial slice 32). ",
                "Attenuation measures ~42 HU. ",
                "No architectural distortion, cavitation, or lymphadenopathy is present. ",
                "Categorized as ACR Lung-RADS 4A (Suspicious).",
            ]
            full_reply: List[str] = []
            for tok in mock_tokens:
                await asyncio.sleep(0.005)
                full_reply.append(tok)
                yield {"token": tok, "is_final": False}

            session["messages"].append({"role": "assistant", "content": "".join(full_reply)})
            yield {"token": "", "is_final": True}
            return

        active_client = client or self.get_client()
        stream = await active_client.chat.completions.create(
            model=MODEL_ID,
            messages=session["messages"],
            temperature=0.3,
            max_tokens=1024,
            stream=True,
        )

        assistant_reply: List[str] = []
        async for chunk in stream:
            delta = chunk.choices[0].delta.content or ""
            if delta:
                assistant_reply.append(delta)
                yield {"token": delta, "is_final": False}

        session["messages"].append({"role": "assistant", "content": "".join(assistant_reply)})
        yield {"token": "", "is_final": True}


class MedGemmaVQAServicer:
    """gRPC Servicer adapter wrapping the MedGemmaVQASessionManager."""

    def __init__(self, study_cache: Optional[Dict[str, Any]] = None):
        self.session_manager = MedGemmaVQASessionManager()
        if study_cache is not None:
            self.session_manager.study_cache = study_cache

    async def StreamVQA(self, request: Any, context: Any, mock_mode: bool = False):
        study_id = getattr(request, "study_id", "")
        question = getattr(request, "question", "")

        async for chunk in self.session_manager.stream_question(
            study_id=study_id,
            question=question,
            mock_mode=mock_mode,
        ):
            yield chunk

