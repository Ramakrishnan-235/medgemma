#!/usr/bin/env python3
"""
MedGemma Inference Engine Verification CLI
Inspects CUDA hardware, model weights, 4-bit NF4 quantization, and VRAM headroom.
"""
import json
import sys
from pathlib import Path

# Add project root and apps/api to sys.path
root_dir = Path(__file__).resolve().parent
apps_api_dir = root_dir / "apps" / "api"
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))
if str(apps_api_dir) not in sys.path:
    sys.path.insert(0, str(apps_api_dir))

from apps.api.app.services.engine_verification import run_engine_verification


def main() -> int:
    print("=" * 65)
    print("  MedGemma 1.5 4B Neural Engine Diagnostic Probe")
    print("=" * 65)

    force_mock = "--mock" in sys.argv
    res = run_engine_verification(force_mock=force_mock)

    print(f"Status:                      {res.status.upper()}")
    print(f"Operational Mode:            {res.mode}")
    print(f"CUDA Available:              {res.cuda_available}")
    if res.device_name:
        print(f"CUDA Device:                 {res.device_name}")
    print(f"VRAM Total / Free (MB):      {res.vram_total_mb:.1f} / {res.vram_free_mb:.1f}")
    print(f"Weights Present:             {res.weights_present} ({res.weights_path})")
    print(f"BitsAndBytes 4-bit NF4:      {res.bitsandbytes_4bit_loaded}")
    if res.probe_inference_latency_ms is not None:
        print(f"Probe Latency (ms):          {res.probe_inference_latency_ms:.1f}")
    print(f"Probe Tokens Parsed:         {res.probe_tokens_parsed}")
    print("-" * 65)
    print(f"Details: {res.details}")
    print("=" * 65)

    if "--json" in sys.argv:
        print("\nJSON Output:")
        print(json.dumps(res.model_dump(), indent=2))

    return 0 if res.status in ("operational", "degraded") else 1


if __name__ == "__main__":
    sys.exit(main())
