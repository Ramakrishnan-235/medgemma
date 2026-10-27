# MedGemma 1.5 4B on NVIDIA CUDA

This project uses the local `models/medgemma-1.5-4b-it` checkpoint and 4-bit NF4 quantization. Inference reads local files and does not send prompts or images to Hugging Face.

Run these commands from the project root directory (`D:\MedGemma`):

```powershell
uv sync
uv run medgemma-app --check
uv run medgemma-app --prompt "Explain what a red blood cell does in one sentence."
```

PyTorch is pinned to version 2.14.1 from the official CUDA 12.6 index in `pyproject.toml` and `uv.lock`. Its wheel includes the CUDA runtime; this setup uses the existing NVIDIA driver.

For a local image:

```powershell
uv run medgemma-app --image "D:\images\example.png" --prompt "Describe this image." --max-new-tokens 64
```

The RTX 2050 has 4 GB VRAM. If a prompt or image exceeds available GPU memory, add `--cpu-offload`, which reserves a smaller GPU budget and uses CPU RAM for some model components. This can be slower. Shorter prompts and fewer output tokens also reduce memory use.

```powershell
uv run medgemma-app --cpu-offload --prompt "Explain what a red blood cell does." --max-new-tokens 64
```

The default limit is 128 new tokens; the launcher accepts 1–512. `--check` runs a CUDA matrix computation without loading the model.

## Workspace services and validation

The repository also contains a FastAPI API in `apps/api`, Celery ingestion and analysis workers, a Next.js design preview in `apps/web`, and a GPU HTTP service scaffold in `apps/gpu-service`.

The HTTP scaffold implements **only** `MEDGEMMA_MODE=mock_deterministic`. It returns fixture output for integration testing. In other modes its health and generation endpoints return HTTP 503. Real local CUDA inference is available through the CLI above; it has not been connected to the HTTP scaffold. Most frontend screens remain a design preview with session-local data.

Run the complete backend suite from the root:

```powershell
.\.venv\Scripts\python.exe -m pytest tests apps/api/tests -q -p no:cacheprovider
```

The suite uses deterministic embeddings, HTTP mocks, and SQLite test adapters for PostgreSQL types. It does not download models or validate real model quality, PostgreSQL vector queries, or a deployed service stack. Install the `dev` dependency group with `uv sync --group dev` if needed.

Run frontend checks from `apps/web`:

```powershell
npm ci
npm run type-check
npm run build
```

Configuration now uses one typed `Settings` schema. Process environment values override the nearest `.env` found in the working directory or its first two parents. `CORS_ORIGINS` accepts a comma-separated string or a JSON array. See [REFACTOR_REPORT.md](REFACTOR_REPORT.md) for the baseline, changes, and verification limits.
