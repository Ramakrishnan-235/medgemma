"""Local MedGemma inference using NVIDIA CUDA and NF4 quantization."""
from __future__ import annotations

import argparse
from pathlib import Path

MODEL_DIR = Path(__file__).resolve().parents[2] / "models" / "medgemma-1.5-4b-it"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Check CUDA without loading the model")
    parser.add_argument("--prompt", default="Explain what a red blood cell does in one sentence.")
    parser.add_argument("--image", type=Path, help="Optional local image")
    parser.add_argument("--max-new-tokens", type=int, default=128)
    parser.add_argument("--cpu-offload", action="store_true", help="Use CPU RAM when GPU memory is limited")
    args = parser.parse_args()
    if not 1 <= args.max_new_tokens <= 512:
        parser.error("--max-new-tokens must be between 1 and 512")
    if args.image is not None and not args.image.is_file():
        parser.error(f"Image not found: {args.image}")

    import torch

    print(f"PyTorch: {torch.__version__}; CUDA runtime: {torch.version.cuda}", flush=True)
    if not torch.cuda.is_available():
        raise SystemExit("CUDA is unavailable. Run uv sync using the project's CUDA dependency configuration.")
    free, total = torch.cuda.mem_get_info()
    print(f"GPU: {torch.cuda.get_device_name(0)}; free/total: {free / 2**30:.2f}/{total / 2**30:.2f} GiB", flush=True)
    # Verify an actual CUDA operation, beyond driver/device discovery.
    x = torch.ones((16, 16), device="cuda")
    assert (x @ x).sum().item() == 4096
    del x
    if args.check:
        print("CUDA computation: OK", flush=True)
        return
    if not (MODEL_DIR / "model.safetensors.index.json").is_file():
        raise SystemExit(f"Model files not found: {MODEL_DIR}")

    from transformers import AutoModelForImageTextToText, AutoProcessor, BitsAndBytesConfig

    dtype = torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16
    quantization = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_use_double_quant=True,
        bnb_4bit_compute_dtype=dtype,
        llm_int8_enable_fp32_cpu_offload=args.cpu_offload,
    )
    placement = {"device_map": {"": 0}}
    if args.cpu_offload:
        placement = {"device_map": "auto", "max_memory": {0: "2800MiB", "cpu": "4GiB"}}
    print("Loading local model in 4-bit NF4...", flush=True)
    try:
        model = AutoModelForImageTextToText.from_pretrained(
            MODEL_DIR,
            local_files_only=True,
            quantization_config=quantization,
            dtype=dtype,
            attn_implementation="sdpa",
            **placement,
        ).eval()
        device_map = getattr(model, "hf_device_map", placement["device_map"])
        print(f"Model footprint: {model.get_memory_footprint() / 2**30:.2f} GiB; placement: {device_map}", flush=True)
        processor = AutoProcessor.from_pretrained(MODEL_DIR, local_files_only=True)
        content = []
        if args.image is not None:
            from PIL import Image
            with Image.open(args.image) as image:
                content.append({"type": "image", "image": image.convert("RGB")})
        content.append({"type": "text", "text": args.prompt})
        inputs = processor.apply_chat_template(
            [{"role": "user", "content": content}],
            add_generation_prompt=True,
            tokenize=True,
            return_dict=True,
            return_tensors="pt",
        ).to(model.device, dtype=dtype)
        input_length = inputs["input_ids"].shape[-1]
        with torch.inference_mode():
            output = model.generate(**inputs, max_new_tokens=args.max_new_tokens, do_sample=False)
        print(processor.decode(output[0, input_length:], skip_special_tokens=True), flush=True)
        print(f"Peak GPU allocation: {torch.cuda.max_memory_allocated() / 2**30:.2f} GiB", flush=True)
    except torch.OutOfMemoryError:
        raise SystemExit("GPU memory is full. Retry with --cpu-offload, a shorter prompt, or fewer output tokens.")


if __name__ == "__main__":
    main()

