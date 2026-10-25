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
