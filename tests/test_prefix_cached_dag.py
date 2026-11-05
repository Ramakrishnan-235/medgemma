import os
import sys
import numpy as np
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "api")))

from app.main import app
from app.services.preprocess_ct import (
    apply_hu_window,
    create_3channel_hu_rgb_image,
    process_raw_hu_volume_for_medgemma,
)
from app.services.inference_router import (
    LungRADSOutput,
    DetectionOutput,
    box_to_physical_mm,
    run_study_pipeline,
)
from app.services.vqa_stream_server import MedGemmaVQASessionManager
from app.services.monai_segmentation_fallback import compute_cubic_mm_volume


@pytest.fixture
def test_client():
    return TestClient(app)


def test_3channel_hu_windowing_pipeline():
    # Synthetic slice with Lung (-600 HU), Soft tissue (40 HU), Bone (800 HU)
    hu_slice = np.full((128, 128), -1000.0, dtype=np.float32)
    hu_slice[20:50, 20:50] = -600.0  # Lung
    hu_slice[50:80, 50:80] = 40.0    # Soft tissue / Mediastinum
    hu_slice[80:110, 80:110] = 800.0 # Bone

    img = create_3channel_hu_rgb_image(hu_slice, target_size=(896, 896))
    assert img.size == (896, 896)
    arr = np.array(img)
    assert arr.shape == (896, 896, 3)
    assert arr.dtype == np.uint8


def test_physical_mm_affine_coordinate_accuracy():
    spatial_meta = {
        "original_shape": [512, 512],
        "pixel_spacing_mm": [0.65, 0.72],  # Non-isotropic row/col spacing
        "slice_thickness_mm": 1.25,
        "slice_z_mm": [float(i * 1.25) for i in range(64)],
    }
    # Box [ymin, xmin, ymax, xmax] spanning 100 units Y (10%), 150 units X (15%)
    box = [100, 100, 200, 250]
    dims = box_to_physical_mm(box, spatial_meta)

    # Expected height: 0.10 * 512 * 0.65 = 33.28 mm
    # Expected width: 0.15 * 512 * 0.72 = 55.296 mm -> 55.30 mm
    # Mean diameter: (33.28 + 55.296) / 2 = 44.288 mm -> 44.29 mm
    assert dims["height_mm"] == pytest.approx(33.28, abs=0.05)
    assert dims["width_mm"] == pytest.approx(55.30, abs=0.05)
    assert dims["mean_diameter_mm"] == pytest.approx(44.29, abs=0.05)


@pytest.mark.asyncio
async def test_dual_path_dag_execution_with_grounding():
    # 1. Prepare raw volume
    vol = np.full((16, 64, 64), -1000.0, dtype=np.float32)
    # Put nodule at slice 8
    vol[7:10, 28:36, 28:36] = 42.0
    spacing = (0.7, 0.7, 1.25)

    images, meta = process_raw_hu_volume_for_medgemma(vol, spacing, max_slices=16)
    assert len(images) == 16

    # 2. Convert to base64
    import io, base64
    b64_slices = []
    for img in images:
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        b64_slices.append(base64.b64encode(buf.getvalue()).decode("ascii"))

    # 3. Run dual-path study pipeline
    output_b, output_d, report_stream = await run_study_pipeline(
        base64_slices=b64_slices,
        spatial_meta=meta,
        mock_mode=True,
    )

    assert output_b["lung_rads_category"] in ["1", "2", "3", "4A", "4B", "4X"]
    assert len(output_d["detections"]) > 0

    first_det = output_d["detections"][0]
    assert "physical_size" in first_det
    assert "z_coord_mm" in first_det

    # 4. Hybrid MONAI 3D volumetry
    monai_res = compute_cubic_mm_volume(vol, spacing, first_det)
    assert monai_res["volume_mm3"] > 0
    assert monai_res["mean_hu"] == pytest.approx(42.0, abs=2.0)

    # 5. Output A Grounded narrative report tokens
    report_tokens = []
    async for chunk in report_stream:
        report_tokens.append(chunk)
    report_text = "".join(report_tokens)
    assert len(report_text) > 0
    assert "Findings" in report_text


@pytest.mark.asyncio
async def test_vqa_multi_turn_warm_prefix_reuse():
    manager = MedGemmaVQASessionManager()
    study_id = "STUDY-E2E-TEST"
    manager.register_study_prefix(study_id, ["b64_slice_0", "b64_slice_1"])

    # Turn 1: Initial query
    t1_tokens = []
    async for chunk in manager.stream_question(study_id, "Locate any suspicious nodule.", mock_mode=True):
        if chunk["token"]:
            t1_tokens.append(chunk["token"])
    t1_text = "".join(t1_tokens)
    assert len(t1_text) > 0

    # Turn 2: Follow-up query reusing same warm prefix
    t2_tokens = []
    async for chunk in manager.stream_question(study_id, "What is the mean attenuation?", mock_mode=True):
        if chunk["token"]:
            t2_tokens.append(chunk["token"])
    t2_text = "".join(t2_tokens)
    assert len(t2_text) > 0

    session = manager.get_session(study_id)
    # Total messages: prefix turn (user, assistant) + Turn 1 (user, assistant) + Turn 2 (user, assistant) = 6
    assert len(session["messages"]) == 6
    assert session["messages"][-1]["content"] == t2_text


def test_full_dag_api_integration(test_client):
    # Test POST /api/v1/ct/dag-pipeline
    resp = test_client.post("/api/v1/ct/dag-pipeline", json={
        "study_id": "STUDY-E2E-FULL",
        "max_slices": 32,
        "stream_report": False,
        "mock_mode": True,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["study_id"] == "STUDY-E2E-FULL"
    assert data["slices_processed"] == 32
    assert "output_b_lung_rads" in data
    assert "output_d_detections" in data
    assert "output_a_narrative_report" in data
    assert len(data["output_d_detections"]) > 0

    first_det = data["output_d_detections"][0]
    assert "physical_size" in first_det
    assert "monai_3d_volume" in first_det
    assert first_det["monai_3d_volume"]["volume_mm3"] > 0

    # Test follow-up VQA stream on warm session: POST /api/v1/ct/vqa-stream
    vqa_resp = test_client.post("/api/v1/ct/vqa-stream", json={
        "study_id": "STUDY-E2E-FULL",
        "question": "Is there any evidence of lymphadenopathy or pleural effusion?",
        "mock_mode": True,
    })
    assert vqa_resp.status_code == 200
    assert "text/event-stream" in vqa_resp.headers["content-type"]
    assert "data:" in vqa_resp.text
    assert "[DONE]" in vqa_resp.text

