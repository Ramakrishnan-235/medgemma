import os
import sys
import pytest
from typing import AsyncGenerator

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "api")))

from app.services.inference_router import (
    LungRADSOutput,
    DetectionOutput,
    LesionBox3D,
    box_to_physical_mm,
    run_study_pipeline,
)


def test_lung_rads_output_schema():
    valid = LungRADSOutput(
        lung_rads_category="4A",
        malignancy_risk_score=0.15,
        primary_findings=["Solid 9mm nodule in right lower lobe"],
        recommended_follow_up="3-month low-dose CT",
    )
    assert valid.lung_rads_category == "4A"
    assert valid.malignancy_risk_score == 0.15

    with pytest.raises(Exception):
        LungRADSOutput(
            lung_rads_category="INVALID",
            malignancy_risk_score=1.5,
            primary_findings=[],
            recommended_follow_up="none",
        )


def test_lesion_box_3d_and_detection_schema():
    box = LesionBox3D(
        slice_index=42,
        label="Pulmonary Nodule",
        box_2d=[150, 200, 350, 400],
    )
    assert box.slice_index == 42
    assert box.box_2d == [150, 200, 350, 400]

    detections = DetectionOutput(detections=[box])
    assert len(detections.detections) == 1


def test_box_to_physical_mm():
    meta = {
        "original_shape": [512, 512],
        "pixel_spacing_mm": [0.68, 0.68],
        "slice_thickness_mm": 1.25,
        "slice_z_mm": [i * 1.25 for i in range(64)],
    }
    # Normalized box: ymin=200, xmin=200, ymax=300, xmax=300 (100 units = 10% of 512 = 51.2 px * 0.68mm = 34.816mm)
    dims = box_to_physical_mm([200, 200, 300, 300], meta)
    assert dims["height_mm"] == pytest.approx(34.82, abs=0.05)
    assert dims["width_mm"] == pytest.approx(34.82, abs=0.05)
    assert dims["mean_diameter_mm"] == pytest.approx(34.82, abs=0.05)


@pytest.mark.asyncio
async def test_run_study_pipeline_mock_mode():
    meta = {
        "original_shape": [512, 512],
        "pixel_spacing_mm": [0.7, 0.7],
        "slice_thickness_mm": 1.25,
        "slice_z_mm": [float(i * 1.25) for i in range(16)],
    }
    dummy_b64 = ["iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="] * 4

    output_b, output_d, report_stream = await run_study_pipeline(
        base64_slices=dummy_b64,
        spatial_meta=meta,
        mock_mode=True,
    )

    # Validate Output B conforms to schema
    validated_b = LungRADSOutput(**output_b)
    assert validated_b.lung_rads_category in ["1", "2", "3", "4A", "4B", "4X"]

    # Validate Output D conforms to schema and has physical mm annotations
    validated_d = DetectionOutput(**output_d)
    assert len(validated_d.detections) > 0
    first_det = output_d["detections"][0]
    assert "physical_size" in first_det
    assert "width_mm" in first_det["physical_size"]
    assert "mean_diameter_mm" in first_det["physical_size"]
    assert "z_coord_mm" in first_det

    # Validate Output A streaming generator produces text tokens
    tokens = []
    async for chunk in report_stream:
        tokens.append(chunk)
    report_text = "".join(tokens)
    assert len(report_text) > 0
    assert "Findings" in report_text or "Impression" in report_text
