import pytest
from starlette.testclient import TestClient
from apps.api.app.main import app


def test_infer_slice_endpoint():
    client = TestClient(app)
    payload = {
        "image_base64": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        "slice_index": 42,
        "pixel_spacing": [0.70, 0.70],
        "original_shape": [512, 512],
        "mock_mode": True,
    }
    response = client.post("/api/v1/ct/infer-slice", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "model_checkpoint" in data
    assert "detections" in data
    assert len(data["detections"]) > 0
    d0 = data["detections"][0]
    assert "box_2d_1000" in d0
    assert len(d0["box_2d_1000"]) == 4
    assert "box_norm" in d0
    assert d0["provenance"] == "mock_fallback"
    assert "physical_size" in d0
    assert d0["physical_size"]["mean_diameter_mm"] > 0
    assert "lung_rads_assessment" in data


def test_verify_engine_endpoint():
    client = TestClient(app)
    response = client.get("/api/v1/ct/verify-engine?mock=true")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "degraded"
    assert data["mode"] == "mock"
    assert data["probe_tokens_parsed"] is True
    assert "Mock Environment" in data["device_name"]

