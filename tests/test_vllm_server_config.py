import re
from pathlib import Path
import pytest

gpu_service_dir = Path(__file__).resolve().parents[1] / "apps" / "gpu-service"
vllm_server_path = gpu_service_dir / "vllm_server.py"
dockerfile_path = gpu_service_dir / "Dockerfile.l4.vllm"
compose_path = Path(__file__).resolve().parents[1] / "docker-compose.gpu-l4.yml"


def test_vllm_server_source_configuration():
    assert vllm_server_path.is_file()
    source = vllm_server_path.read_text(encoding="utf-8")

    # Verify MAX_MODEL_LEN default is 65536
    assert re.search(r'VLLM_MAX_MODEL_LEN",\s*"65536"', source) is not None
    # Verify MAX_IMAGES_PER_PROMPT default is 128
    assert re.search(r'VLLM_MAX_IMAGES_PER_PROMPT",\s*"128"', source) is not None
    # Verify GPU_MEMORY_UTILIZATION default is 0.90
    assert re.search(r'VLLM_GPU_MEMORY_UTILIZATION",\s*"0\.90?"', source) is not None
    # Verify repetition penalty guard
    assert "DEFAULT_REPETITION_PENALTY = 1.05" in source
    # Verify xgrammar backend and prefix caching
    assert "enable_prefix_caching=True" in source
    assert 'guided_decoding_backend="xgrammar"' in source


def test_docker_compose_and_dockerfile_sync():
    compose_text = compose_path.read_text(encoding="utf-8")
    assert 'VLLM_MAX_MODEL_LEN: "65536"' in compose_text
    assert 'VLLM_MAX_IMAGES_PER_PROMPT: "128"' in compose_text
    assert 'VLLM_GPU_MEMORY_UTILIZATION: "0.90"' in compose_text
