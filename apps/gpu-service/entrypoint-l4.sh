#!/usr/bin/env bash
set -euo pipefail

echo "=== MedGemma 1.5 4B Production GPU Entrypoint ==="

if [ -z "${HF_TOKEN:-}" ]; then
  echo "ERROR: HF_TOKEN environment variable is required to pull google/medgemma-1.5-4b-it."
  exit 1
fi

# 1. Verify GPU hardware & minimum VRAM (20,000 MiB for L4 bfloat16 profile)
GPU_INFO=$(nvidia-smi --query-gpu=name,memory.total,memory.free --format=csv,noheader,nounits | head -n 1)
echo "Detected GPU: ${GPU_INFO}"

FREE_VRAM_MIB=$(echo "${GPU_INFO}" | awk -F',' '{gsub(/ /, "", $3); print $3}')
if [ "${FREE_VRAM_MIB}" -lt 19500 ]; then
  echo "WARNING: Free VRAM (${FREE_VRAM_MIB} MiB) is below 19,500 MiB target for L4 bfloat16 profile."
fi

LAUNCH_MODE="${LAUNCH_MODE:-telemetry_gateway}"

if [ "${LAUNCH_MODE}" = "openai_cli" ]; then
  echo "Starting standalone vLLM OpenAI-compatible server..."
  exec vllm serve "${MEDGEMMA_CHECKPOINT:-google/medgemma-1.5-4b-it}" \
    --host 0.0.0.0 \
    --port 8080 \
    --dtype bfloat16 \
    --max-model-len "${VLLM_MAX_MODEL_LEN:-16384}" \
    --max-num-seqs "${MEDGEMMA_MAX_CONCURRENCY:-4}" \
    --gpu-memory-utilization "${VLLM_GPU_MEMORY_UTILIZATION:-0.88}" \
    --limit-mm-per-prompt "image=${VLLM_MAX_IMAGES_PER_PROMPT:-4}" \
    --enable-prefix-caching \
    --disable-log-requests
else
  echo "Starting MedGemma vLLM AsyncLLMEngine Server with 896x896 Letterbox Parity..."
  exec uvicorn vllm_server:app \
    --host 0.0.0.0 \
    --port 8080 \
    --workers 1 \
    --timeout-keep-alive 75 \
    --no-access-log
fi

