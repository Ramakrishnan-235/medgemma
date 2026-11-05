import pytest
from apps.api.app.services.local_medgemma import (
    parse_medgemma_location_tokens,
    clamp_box_1000,
    MedGemmaLocalInferenceEngine,
)


def test_parse_medgemma_location_tokens_tag_format():
    text = "<loc0380><loc0420><loc0440><loc0490> pulmonary nodule"
    detections = parse_medgemma_location_tokens(text)
    assert len(detections) == 1
    det = detections[0]
    assert det["box_2d_1000"] == [380, 420, 440, 490]
    assert det["label"] == "pulmonary nodule"


def test_parse_medgemma_location_tokens_json_format():
    text = '{"slice_index": 42, "box_2d": [350, 400, 430, 480], "label": "nodule"}'
    detections = parse_medgemma_location_tokens(text)
    assert len(detections) == 1
    assert detections[0]["box_2d_1000"] == [350, 400, 430, 480]


def test_parse_medgemma_location_tokens_empty_negative():
    text = "No pulmonary nodules or lesions identified on this axial slice."
    detections = parse_medgemma_location_tokens(text)
    assert detections == []


def test_clamp_box_1000():
    assert clamp_box_1000([-10, 50, 1050, 999]) == [0, 50, 1000, 999]


def test_inference_engine_mock_mode():
    engine = MedGemmaLocalInferenceEngine(force_mock=True)
    res = engine.infer_slice(
        image_base64="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        slice_index=42,
        pixel_spacing=[0.7, 0.7],
    )
    assert res["status"] == "success"
    assert "detections" in res
    assert len(res["detections"]) > 0
    d = res["detections"][0]
    assert "box_2d_1000" in d
    assert "physical_size" in d
    assert d["physical_size"]["mean_diameter_mm"] > 0
    assert "lung_rads_assessment" in res
