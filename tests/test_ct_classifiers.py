import os
import sys
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "api")))

from app.services.ct_classifiers import (
    evaluate_lung_rads_v2022,
    classify_ct_rate_abnormalities,
)


def test_evaluate_lung_rads_v2022_categories():
    # Category 1: Negative
    res_1 = evaluate_lung_rads_v2022(diameter_mm=0.0, nodule_type="none")
    assert res_1.category == "1"
    assert res_1.malignancy_probability < 0.01

    # Category 2: Benign (<6mm solid)
    res_2 = evaluate_lung_rads_v2022(diameter_mm=4.5, nodule_type="solid")
    assert res_2.category == "2"
    assert res_2.malignancy_probability < 0.01

    # Category 3: Probably benign (6 to <8mm solid)
    res_3 = evaluate_lung_rads_v2022(diameter_mm=7.2, nodule_type="solid")
    assert res_3.category == "3"
    assert 0.01 <= res_3.malignancy_probability <= 0.03

    # Category 4A: Suspicious (8 to <15mm solid)
    res_4a = evaluate_lung_rads_v2022(diameter_mm=9.5, nodule_type="solid")
    assert res_4a.category == "4A"
    assert 0.05 <= res_4a.malignancy_probability <= 0.15

    # Category 4B: Very suspicious (>=15mm solid)
    res_4b = evaluate_lung_rads_v2022(diameter_mm=16.5, nodule_type="solid")
    assert res_4b.category == "4B"
    assert res_4b.malignancy_probability > 0.15

    # Category 4X: Category 3 or 4 with high risk / spiculation
    res_4x = evaluate_lung_rads_v2022(
        diameter_mm=9.0,
        nodule_type="solid",
        has_spiculation_or_high_risk=True,
    )
    assert res_4x.category == "4X"
    assert res_4x.malignancy_probability > 0.15


def test_classify_ct_rate_abnormalities():
    labels = classify_ct_rate_abnormalities(
        primary_roi_label="Segment VII hypodense lesion",
        mean_hu=42.0,
        volume_cm3=1.05,
    )

    # All 18 fields must exist and be within [0.0, 1.0]
    data = labels.model_dump()
    assert len(data) == 18
    for key, val in data.items():
        assert 0.0 <= val <= 1.0

    assert labels.nodule >= 0.85
    assert labels.normal <= 0.15
    assert "nodule" in labels.present_conditions(threshold=0.5)


def test_classify_ct_rate_fracture_and_effusion():
    labels = classify_ct_rate_abnormalities(
        primary_roi_label="Pleural fluid collection and rib fracture",
        mean_hu=15.0,
        volume_cm3=12.0,
    )
    assert labels.pleural_effusion >= 0.80
    assert labels.fracture >= 0.80

