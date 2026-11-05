import asyncio
import os
import time
import uuid
from contextlib import asynccontextmanager

import torch
from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel, Field
from transformers import AutoProcessor
from vllm import AsyncEngineArgs, AsyncLLMEngine, SamplingParams

from processors import PROCESSOR_VERSION, decode_and_normalize_b64_images

CHECKPOINT = os.getenv("MEDGEMMA_CHECKPOINT", "google/medgemma-1.5-4b-it")
MAX_CONCURRENCY = int(os.getenv("MEDGEMMA_MAX_CONCURRENCY", "4"))
MAX_QUEUE_DEPTH = int(os.getenv("MEDGEMMA_MAX_QUEUE_DEPTH", "16"))
MAX_MODEL_LEN = int(os.getenv("VLLM_MAX_MODEL_LEN", "65536"))
GPU_MEM_UTIL = float(os.getenv("VLLM_GPU_MEMORY_UTILIZATION", "0.90"))
MAX_IMAGES_PER_PROMPT = int(os.getenv("VLLM_MAX_IMAGES_PER_PROMPT", "128"))
DEFAULT_REPETITION_PENALTY = 1.05


class ImageInput(BaseModel):
    image_id: str
    base64_png: str


class MedGemmaGenerateRequest(BaseModel):
    system_instruction: str
    user_prompt: str
    images: list[ImageInput] = Field(default_factory=list, max_length=128)
    max_new_tokens: int = Field(default=768, ge=16, le=2048)


class MedGemmaGenerateResponse(BaseModel):
    generated_text: str
    model_checkpoint: str
    processor_version: str
    execution_mode: str = "vllm_l4_bfloat16"
    queue_wait_ms: int
    ttft_ms: int
    inference_ms: int
    input_token_count: int
    output_token_count: int
    preprocessed_image_sha256: list[str] = Field(default_factory=list)


class VLLMRuntimeState:
    engine: AsyncLLMEngine | None = None
    processor: AutoProcessor | None = None
    semaphore: asyncio.Semaphore = asyncio.Semaphore(MAX_CONCURRENCY)
    waiting_requests: int = 0
    total_completed: int = 0
    total_failed: int = 0


state = VLLMRuntimeState()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Load official Hugging Face AutoProcessor to guarantee chat-template parity
    state.processor = AutoProcessor.from_pretrained(
        CHECKPOINT,
        token=os.getenv("HF_TOKEN"),
        trust_remote_code=False,
    )

    # 2. Initialize vLLM AsyncLLMEngine tuned for 24 GB NVIDIA L4
    engine_args = AsyncEngineArgs(
        model=CHECKPOINT,
        tokenizer=CHECKPOINT,
        dtype="bfloat16",
        max_model_len=MAX_MODEL_LEN,
        max_num_seqs=MAX_CONCURRENCY,
        gpu_memory_utilization=GPU_MEM_UTIL,
        enable_prefix_caching=True,
        guided_decoding_backend="xgrammar",
        limit_mm_per_prompt={"image": MAX_IMAGES_PER_PROMPT},
        enforce_eager=False,
        disable_log_requests=True,
    )
    state.engine = AsyncLLMEngine.from_engine_args(engine_args)
    yield


app = FastAPI(
    title="MedGemma 1.5 4B vLLM Production Service (L4 24GB)",
    lifespan=lifespan,
)


@app.get("/health/gpu")
async def gpu_health() -> dict:
    if state.engine is None or not torch.cuda.is_available():
        raise HTTPException(status_code=503, detail="vLLM engine or CUDA device unavailable.")

    free_bytes, total_bytes = torch.cuda.mem_get_info(0)
    used_gb = round((total_bytes - free_bytes) / (1024**3), 2)
    total_gb = round(total_bytes / (1024**3), 2)

    return {
        "status": "healthy",
        "device_name": torch.cuda.get_device_name(0),
        "model_checkpoint": CHECKPOINT,
        "processor_version": PROCESSOR_VERSION,
        "vram_used_gb": used_gb,
        "vram_total_gb": total_gb,
        "max_concurrency": MAX_CONCURRENCY,
        "waiting_requests": state.waiting_requests,
        "total_completed": state.total_completed,
        "total_failed": state.total_failed,
    }


@app.post("/v1/generate", response_model=MedGemmaGenerateResponse)
async def generate(req: MedGemmaGenerateRequest) -> MedGemmaGenerateResponse:
    if state.engine is None or state.processor is None:
        raise HTTPException(status_code=503, detail="vLLM engine not initialized.")

    if len(req.images) > MAX_IMAGES_PER_PROMPT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Exceeded max images per prompt ({MAX_IMAGES_PER_PROMPT}).",
        )

    # Bound queue length so interactive requests fail fast instead of stalling workers
    if state.waiting_requests >= MAX_QUEUE_DEPTH:
        state.total_failed += 1
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"GPU queue depth limit ({MAX_QUEUE_DEPTH}) reached. Retry shortly.",
        )

    enqueued_at = time.perf_counter()
    state.waiting_requests += 1

    try:
        async with state.semaphore:
            state.waiting_requests -= 1
            started_at = time.perf_counter()
            queue_wait_ms = int((started_at - enqueued_at) * 1000)

            # 1. Deterministic 896x896 letterbox preprocessing on CPU thread
            pil_images, image_digests = await asyncio.to_thread(
                decode_and_normalize_b64_images,
                [img.model_dump() for img in req.images],
            )

            # 2. Construct Gemma 3 / MedGemma 1.5 chat template identical to Transformers baseline
            user_content: list[dict] = [{"type": "image"} for _ in pil_images]
            user_content.append({"type": "text", "text": req.user_prompt})
            messages = [
                {
                    "role": "system",
                    "content": [{"type": "text", "text": req.system_instruction}],
                },
                {"role": "user", "content": user_content},
            ]

            prompt_str: str = state.processor.apply_chat_template(
                messages,
                tokenize=False,
                add_generation_prompt=True,
            )

            # Greedy decoding (temperature=0.0) with repetition penalty to prevent whitespace loops
            sampling_params = SamplingParams(
                temperature=0.0,
                top_p=1.0,
                max_tokens=req.max_new_tokens,
                repetition_penalty=DEFAULT_REPETITION_PENALTY,
            )

            vllm_inputs: dict = {"prompt": prompt_str}
            if pil_images:
                vllm_inputs["multi_modal_data"] = {
                    "image": pil_images[0] if len(pil_images) == 1 else pil_images
                }

            request_id = f"medgemma-{uuid.uuid4()}"
            ttft_ms: int | None = None
            final_output = None

            async for request_output in state.engine.generate(
                vllm_inputs, sampling_params, request_id=request_id
            ):
                if ttft_ms is None and request_output.outputs and request_output.outputs[0].token_ids:
                    ttft_ms = int((time.perf_counter() - started_at) * 1000)
                final_output = request_output

            if final_output is None or not final_output.outputs:
                raise RuntimeError("vLLM returned empty generation output.")

            inference_ms = int((time.perf_counter() - started_at) * 1000)
            completion = final_output.outputs[0]
            in_tokens = len(final_output.prompt_token_ids or [])
            out_tokens = len(completion.token_ids or [])
            state.total_completed += 1

            return MedGemmaGenerateResponse(
                generated_text=completion.text.strip(),
                model_checkpoint=CHECKPOINT,
                processor_version=PROCESSOR_VERSION,
                execution_mode="vllm_l4_bfloat16",
                queue_wait_ms=queue_wait_ms,
                ttft_ms=ttft_ms if ttft_ms is not None else inference_ms,
                inference_ms=inference_ms,
                input_token_count=in_tokens,
                output_token_count=out_tokens,
                preprocessed_image_sha256=image_digests,
            )
    except HTTPException:
        raise
    except Exception as exc:
        state.total_failed += 1
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"MedGemma vLLM inference failure: {exc}",
        ) from exc
    finally:
        if state.waiting_requests > 0 and state.semaphore.locked():
            pass

