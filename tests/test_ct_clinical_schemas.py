import os
import sys
import pytest
from pydantic import ValidationError

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "api")))

from app.schemas.ct_clinical import (
    NormalizedBox1000,
    LungRadsAssessment,
    CTRateMultiOrganLabels,
    FreeFormRadiologyReport,
    LongitudinalComparisonReport,
    TargetedSliceVQARequest,
    TargetedSliceVQAResponse,
    VisualGroundingAnnotation,
)


def test_normalized_box_validation():
    # Valid box [ymin, xmin, ymax, xmax] in 0..1000
    box = NormalizedBox1000(ymin=120, xmin=150, ymax=450, xmax=600)
    assert box.ymin == 120
    assert box.to_normalized_float() == (0.12, 0.15, 0.45, 0.6)

    # Inverted box should fail validation
    with pytest.raises(ValidationError):
        NormalizedBox1000(ymin=500, xmin=100, ymax=400, xmax=300)

    # Out of range should fail validation
    with pytest.raises(ValidationError):
        NormalizedBox1000(ymin=-5, xmin=100, ymax=400, xmax=300)

    with pytest.raises(ValidationError):
        NormalizedBox1000(ymin=100, xmin=100, ymax=1050, xmax=300)


def test_lung_rads_assessment_schema():
    assessment = LungRadsAssessment(
        category="4A",
        score_description="Suspicious nodule (8 to <15mm solid)",
        malignancy_probability=0.12,
        recommended_management="3-month low-dose CT or PET-CT",
        primary_nodule_size_mm=9.5,
    )
    assert assessment.category == "4A"
    assert assessment.malignancy_probability == 0.12


def test_ct_rate_18_classes_schema():
    labels = CTRateMultiOrganLabels(
        nodule=0.94,
        consolidation=0.08,
        pleural_effusion=0.02,
        medical_device=0.0,
    )
    assert labels.nodule == 0.94
    conditions = labels.present_conditions(threshold=0.5)
    assert len(conditions) == 1
    assert "nodule" in conditions


def test_free_form_radiology_report_schema():
    report = FreeFormRadiologyReport(
        case_id="CASE-2026-0894",
        modality="3D CT",
        technique="Axial helical acquisition 120 kVp B30f soft kernel",
        comparison="None available",
        findings_markdown="## FINDINGS\nLungs: Clear.\nLiver: Hypodense lesion.",
        impression_markdown="## IMPRESSION\n1. Segment VII hypodense lesion.",
    )
    assert report.case_id == "CASE-2026-0894"
    assert "FINDINGS" in report.findings_markdown


def test_longitudinal_comparison_schema():
    comp = LongitudinalComparisonReport(
        case_id="CASE-2026-0894",
        prior_study_date="2026-01-15",
        current_study_date="2026-04-20",
        interval_days=95,
        diameter_change_mm=3.0,
        diameter_change_percent=26.8,
        volume_change_cm3=0.33,
        volume_change_percent=45.8,
        hu_attenuation_change=4.0,
        recist_category="Progressive Disease",
        summary_text="Lesion increased in longest diameter by 26.8% over 95 days.",
    )
    assert comp.recist_category == "Progressive Disease"
    assert comp.interval_days == 95


def test_targeted_slice_vqa_schema():
    req = TargetedSliceVQARequest(
        case_id="CASE-2026-0894",
        slice_index=64,
        tissue_window="soft_tissue",
        question="Describe the lesion on slice 64",
    )
    assert req.slice_index == 64
    assert req.tissue_window == "soft_tissue"

    resp = TargetedSliceVQAResponse(
        slice_index=64,
        question="Describe the lesion on slice 64",
        answer_markdown="Hypodense hepatic nodule measuring 14.2mm in segment VII.",
        confidence_score=0.94,
        grounded_box=NormalizedBox1000(ymin=350, xmin=300, ymax=490, xmax=460),
    )
    assert resp.confidence_score == 0.94
    assert resp.grounded_box is not None


def test_visual_grounding_annotation_schema():
    anno = VisualGroundingAnnotation(
        id="ANNO-01",
        slice_index=64,
        label="Segment VII hypodense lesion",
        confidence=0.964,
        box_1000=NormalizedBox1000(ymin=350, xmin=300, ymax=490, xmax=460),
        anatomical_region="Liver",
        finding_type="Lesion",
    )
    assert anno.box_1000.ymin == 350
    assert anno.confidence == 0.964

