import os
import sys
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "api")))

from app.services.fhir_exporter import build_fhir_r4_diagnostic_bundle


def test_build_fhir_r4_diagnostic_bundle():
    bundle = build_fhir_r4_diagnostic_bundle(
        patient_id="PAT-9842",
        case_id="CASE-2026-0894",
        modality="CT",
        narrative_impression="Focal hypodense nodular lesion in liver segment VII.",
        measurements=[
            {"code": "24606-6", "display": "Nodule Long Axis Diameter", "value": 14.2, "unit": "mm"},
            {"code": "volume", "display": "3D Lesion Volume", "value": 1.05, "unit": "cm3"},
            {"code": "attenuation", "display": "Mean CT Attenuation", "value": 42.0, "unit": "[HU]"},
        ],
        lung_rads_score="4A",
    )

    assert bundle["resourceType"] == "Bundle"
    assert bundle["type"] == "transaction"
    entries = bundle["entry"]
    assert len(entries) >= 4  # DiagnosticReport + 3 Observations + Lung-RADS

    # Verify DiagnosticReport resource
    report_entry = next(e["resource"] for e in entries if e["resource"]["resourceType"] == "DiagnosticReport")
    assert report_entry["code"]["coding"][0]["code"] == "24627-2"  # LOINC Diagnostic radiology CT
    assert report_entry["subject"]["reference"] == "Patient/PAT-9842"
    assert report_entry["conclusion"] == "Focal hypodense nodular lesion in liver segment VII."
    assert len(report_entry["result"]) >= 4

    # Verify Observation resources with UCUM units
    obs_entries = [e["resource"] for e in entries if e["resource"]["resourceType"] == "Observation"]
    units = [obs.get("valueQuantity", {}).get("unit") for obs in obs_entries if "valueQuantity" in obs]
    assert "mm" in units
    assert "cm3" in units
    assert "[HU]" in units

    # Verify Lung-RADS Observation
    rads_obs = next(
        (o for o in obs_entries if any(c.get("code") == "79040-2" for c in o["code"]["coding"])),
        None,
    )
    assert rads_obs is not None
    assert rads_obs["valueCodeableConcept"]["coding"][0]["code"] == "4A"

