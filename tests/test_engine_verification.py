import pytest
from apps.api.app.services.engine_verification import run_engine_verification


def test_engine_verification_mock_mode():
    res = run_engine_verification(force_mock=True)
    assert res.mode == "mock"
    assert res.status == "degraded"
    assert res.probe_tokens_parsed is True
    assert "Mock Environment" in res.device_name


def test_engine_verification_live_probe_schema():
    res = run_engine_verification(force_mock=False)
    assert res.status in ("operational", "degraded", "unavailable")
    assert isinstance(res.cuda_available, bool)
    assert isinstance(res.weights_present, bool)
    assert res.vram_total_mb >= 0.0
    assert res.vram_free_mb >= 0.0
    assert res.mode in ("live_cuda_nf4", "mock", "cpu_fallback")
    assert len(res.details) > 0
