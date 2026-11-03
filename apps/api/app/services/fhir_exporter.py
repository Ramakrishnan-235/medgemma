import uuid
from datetime import datetime, timezone
from typing import Any


def build_fhir_r4_diagnostic_bundle(
    patient_id: str,
    case_id: str,
    modality: str = "CT",
    narrative_impression: str = "",
    measurements: list[dict[str, Any]] | None = None,
    lung_rads_score: str | None = None,
) -> dict[str, Any]:
    """
    Constructs an HL7 FHIR Release 4 transaction Bundle for direct ingestion
    into Electronic Health Record (EHR) systems.
    Contains DiagnosticReport and linked quantitative/qualitative Observation resources.
    """
    measurements = measurements or []
    now_iso = datetime.now(timezone.utc).isoformat()
    bundle_id = str(uuid.uuid4())
    report_id = str(uuid.uuid4())

    entries: list[dict[str, Any]] = []
    observation_references: list[dict[str, str]] = []

    # 1. Build Observations for physical measurements
    for idx, m in enumerate(measurements):
        obs_id = str(uuid.uuid4())
        obs_code = m.get("code", f"obs-{idx}")
        obs_display = m.get("display", "Clinical Imaging Metric")
        obs_value = float(m.get("value", 0.0))
        obs_unit = str(m.get("unit", ""))

        obs_resource = {
            "resourceType": "Observation",
            "id": obs_id,
            "status": "final",
            "category": [
                {
                    "coding": [
                        {
                            "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                            "code": "imaging",
                            "display": "Imaging",
                        }
                    ]
                }
            ],
            "code": {
                "coding": [
                    {
                        "system": "http://loinc.org",
                        "code": obs_code,
                        "display": obs_display,
                    }
                ],
                "text": obs_display,
            },
            "subject": {"reference": f"Patient/{patient_id}"},
            "effectiveDateTime": now_iso,
            "valueQuantity": {
                "value": obs_value,
                "unit": obs_unit,
                "system": "http://unitsofmeasure.org",
                "code": obs_unit,
            },
        }

        entries.append({
            "fullUrl": f"urn:uuid:{obs_id}",
            "resource": obs_resource,
            "request": {"method": "POST", "url": "Observation"},
        })
        observation_references.append({"reference": f"urn:uuid:{obs_id}"})

    # 2. Build Observation for Lung-RADS score if present
    if lung_rads_score:
        rads_obs_id = str(uuid.uuid4())
        rads_obs_resource = {
            "resourceType": "Observation",
            "id": rads_obs_id,
            "status": "final",
            "category": [
                {
                    "coding": [
                        {
                            "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                            "code": "imaging",
                            "display": "Imaging",
                        }
                    ]
                }
            ],
            "code": {
                "coding": [
                    {
                        "system": "http://loinc.org",
                        "code": "79040-2",
                        "display": "Lung-RADS category",
                    }
                ],
                "text": "Lung-RADS Assessment Category",
            },
            "subject": {"reference": f"Patient/{patient_id}"},
            "effectiveDateTime": now_iso,
            "valueCodeableConcept": {
                "coding": [
                    {
                        "system": "https://www.acr.org/Clinical-Resources/Reporting-and-Data-Systems/Lung-RADS",
                        "code": lung_rads_score,
                        "display": f"Category {lung_rads_score}",
                    }
                ],
                "text": f"Lung-RADS Category {lung_rads_score}",
            },
        }
        entries.append({
            "fullUrl": f"urn:uuid:{rads_obs_id}",
            "resource": rads_obs_resource,
            "request": {"method": "POST", "url": "Observation"},
        })
        observation_references.append({"reference": f"urn:uuid:{rads_obs_id}"})

    # 3. Build DiagnosticReport resource referencing all observations
    diagnostic_report_resource = {
        "resourceType": "DiagnosticReport",
        "id": report_id,
        "identifier": [
            {
                "system": "urn:medgemma:case-id",
                "value": case_id,
            }
        ],
        "status": "final",
        "category": [
            {
                "coding": [
                    {
                        "system": "http://terminology.hl7.org/CodeSystem/v2-0074",
                        "code": "RAD",
                        "display": "Radiology",
                    }
                ]
            }
        ],
        "code": {
            "coding": [
                {
                    "system": "http://loinc.org",
                    "code": "24627-2",
                    "display": "CT Chest / Abdomen with multi-planar reconstruction",
                }
            ],
            "text": f"{modality} Volumetric Radiology Examination",
        },
        "subject": {"reference": f"Patient/{patient_id}"},
        "effectiveDateTime": now_iso,
        "issued": now_iso,
        "result": observation_references,
        "conclusion": narrative_impression,
    }

    # Prepend DiagnosticReport so it is the primary entry in the bundle
    entries.insert(0, {
        "fullUrl": f"urn:uuid:{report_id}",
        "resource": diagnostic_report_resource,
        "request": {"method": "POST", "url": "DiagnosticReport"},
    })

    return {
        "resourceType": "Bundle",
        "id": bundle_id,
        "type": "transaction",
        "timestamp": now_iso,
        "entry": entries,
    }

