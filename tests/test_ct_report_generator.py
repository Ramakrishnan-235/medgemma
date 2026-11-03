import os
import sys
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "api")))

from app.services.ct_report_generator import (
    generate_narrative_radiology_report,
    generate_longitudinal_comparison,
)


def test_generate_narrative_radiology_report():
    report = generate_narrative_radiology_report(
        case_id="CASE-2026-0894",
        lesion_data={
            "peak_slice": 64,
            "dimensions_str": "14.2 × 11.8 × 12.0 mm",
            "volume_cm3": 1.05,
            "mean_hu": 42.0,
            "anatomical_location": "Liver dome / segment VII",
        },
        telemetry={"matrix": "512×512", "slice_thickness_mm": 1.25, "kernel": "B30f soft"},
    )
    assert report.technique != ""
    assert "FINDINGS" in report.findings_markdown
    assert "IMPRESSION" in report.impression_markdown
    assert "segment VII" in report.findings_markdown or "segment vii" in report.impression_markdown.lower()
    assert "Lungs/Pleura" in report.organ_observations
    assert "Abdomen/Liver" in report.organ_observations


def test_generate_longitudinal_comparison():
    prior_scan = {
        "study_date": "2026-01-15",
        "lesion_longest_diameter_mm": 11.2,
        "volume_cm3": 0.72,
        "mean_hu": 38.0,
    }
    current_scan = {
        "study_date": "2026-04-20",
        "lesion_longest_diameter_mm": 14.2,
        "volume_cm3": 1.05,
        "mean_hu": 42.0,
    }
    comparison = generate_longitudinal_comparison(
        case_id="CASE-2026-0894",
        prior_study=prior_scan,
        current_study=current_scan,
    )
    assert comparison.diameter_change_mm == pytest.approx(3.0, rel=1e-2)
    assert comparison.volume_change_cm3 == pytest.approx(0.33, rel=1e-2)
    assert comparison.interval_days == 95
    assert comparison.recist_category == "Progressive Disease"
    assert "increased" in comparison.summary_text.lower()


def test_generate_longitudinal_comparison_stable():
    prior_scan = {
        "study_date": "2026-01-15",
        "lesion_longest_diameter_mm": 14.0,
        "volume_cm3": 1.00,
        "mean_hu": 42.0,
    }
    current_scan = {
        "study_date": "2026-04-20",
        "lesion_longest_diameter_mm": 14.2,
        "volume_cm3": 1.02,
        "mean_hu": 42.0,
    }
    comparison = generate_longitudinal_comparison(
        case_id="CASE-2026-0894",
        prior_study=prior_scan,
        current_study=current_scan,
    )
    assert comparison.recist_category == "Stable Disease"
    assert comparison.interval_days == 95

