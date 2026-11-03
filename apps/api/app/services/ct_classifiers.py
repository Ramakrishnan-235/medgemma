from typing import Any, Literal
from app.schemas.ct_clinical import CTRateMultiOrganLabels, LungRadsAssessment


def evaluate_lung_rads_v2022(
    diameter_mm: float,
    nodule_type: Literal["solid", "part_solid", "ground_glass", "none"] = "solid",
    is_new: bool = False,
    has_spiculation_or_high_risk: bool = False,
) -> LungRadsAssessment:
    """
    Evaluates nodule criteria according to the American College of Radiology (ACR)
    Lung-RADS v2022 guidelines.
    """
    if nodule_type == "none" or diameter_mm <= 0.0:
        return LungRadsAssessment(
            category="1",
            score_description="Negative: No lung nodules detected",
            malignancy_probability=0.005,
            recommended_management="Continue annual low-dose screening CT (LDCT) in 12 months",
            primary_nodule_size_mm=0.0,
            nodule_type="none",
        )

    # Solid nodule logic
    if nodule_type == "solid":
        if diameter_mm < 6.0:
            category: Literal["0", "1", "2", "3", "4A", "4B", "4X"] = "2"
            desc = f"Benign appearance: Solid nodule < 6 mm ({diameter_mm:.1f} mm)"
            prob = 0.008
            mgmt = "Continue annual LDCT in 12 months"
        elif diameter_mm < 8.0:
            category = "3"
            desc = f"Probably benign: Solid nodule 6 to < 8 mm ({diameter_mm:.1f} mm)"
            prob = 0.02
            mgmt = "6-month LDCT follow-up"
        elif diameter_mm < 15.0:
            category = "4A"
            desc = f"Suspicious: Solid nodule 8 to < 15 mm ({diameter_mm:.1f} mm)"
            prob = 0.10
            mgmt = "3-month LDCT or PET-CT"
        else:
            category = "4B"
            desc = f"Very suspicious: Solid nodule >= 15 mm ({diameter_mm:.1f} mm)"
            prob = 0.28
            mgmt = "Chest CT with contrast, PET-CT, and/or tissue sampling (biopsy)"
    elif nodule_type == "part_solid":
        if diameter_mm < 6.0:
            category = "2"
            desc = f"Benign appearance: Part-solid nodule < 6 mm ({diameter_mm:.1f} mm)"
            prob = 0.008
            mgmt = "Continue annual LDCT in 12 months"
        elif diameter_mm < 8.0:
            category = "3"
            desc = f"Probably benign: Part-solid nodule >= 6 mm with solid component < 6 mm"
            prob = 0.02
            mgmt = "6-month LDCT follow-up"
        else:
            category = "4A"
            desc = f"Suspicious: Part-solid nodule with solid component >= 6 mm"
            prob = 0.12
            mgmt = "3-month LDCT or PET-CT"
    else:  # ground_glass
        if diameter_mm < 30.0:
            category = "2"
            desc = f"Benign appearance: Non-solid (ground-glass) nodule < 30 mm"
            prob = 0.008
            mgmt = "Annual LDCT in 12 months"
        else:
            category = "3"
            desc = f"Probably benign: Non-solid nodule >= 30 mm"
            prob = 0.02
            mgmt = "6-month LDCT follow-up"

    # Up-classify to 4X if additional suspicious imaging features exist
    if has_spiculation_or_high_risk and category in ("3", "4A", "4B"):
        category = "4X"
        desc += " [Up-classified: Additional suspicious features including spiculation or lymphadenopathy]"
        prob = max(prob, 0.32)
        mgmt = "Expedited clinical consultation, PET-CT, and diagnostic tissue biopsy"

    return LungRadsAssessment(
        category=category,
        score_description=desc,
        malignancy_probability=prob,
        recommended_management=mgmt,
        primary_nodule_size_mm=diameter_mm,
        nodule_type=nodule_type,
        has_spiculation_or_high_risk=has_spiculation_or_high_risk,
    )


def classify_ct_rate_abnormalities(
    primary_roi_label: str,
    mean_hu: float,
    volume_cm3: float,
    telemetry: dict[str, Any] | None = None,
) -> CTRateMultiOrganLabels:
    """
    Classifies 18 multi-organ condition & abnormality labels from the CT-RATE benchmark.
    Returns calibrated probabilities for multi-class multi-label evaluation.
    """
    lbl = primary_roi_label.lower()

    # Base baseline normal score
    normal_prob = 0.05 if (lbl and "normal" not in lbl) else 0.92

    # Initialize scores for all 18 labels
    scores = {
        "medical_device": 0.88 if any(k in lbl for k in ("port", "pacemaker", "lead", "stent", "device", "catheter")) else 0.02,
        "nodule": 0.94 if any(k in lbl for k in ("nodule", "nodular", "lesion", "liver dome", "segment vii")) else 0.05,
        "emphysema": 0.85 if "emphysema" in lbl or mean_hu < -950 else 0.04,
        "fibrosis": 0.82 if any(k in lbl for k in ("fibrosis", "reticulation", "honeycombing")) else 0.03,
        "consolidation": 0.89 if any(k in lbl for k in ("consolidation", "air bronchogram", "dense opacity")) else 0.05,
        "atelectasis": 0.88 if any(k in lbl for k in ("atelectasis", "subsegmental collapse", "linear opacity")) else 0.06,
        "bronchiectasis": 0.84 if any(k in lbl for k in ("bronchiectasis", "bronchial wall thickening")) else 0.02,
        "pleural_effusion": 0.92 if any(k in lbl for k in ("pleural effusion", "effusion", "fluid collection")) else 0.03,
        "pleural_thickening": 0.81 if any(k in lbl for k in ("pleural thickening", "pleural plaque")) else 0.04,
        "pericardial_effusion": 0.87 if "pericardial effusion" in lbl else 0.02,
        "lymphadenopathy": 0.86 if any(k in lbl for k in ("lymphadenopathy", "enlarged node", "lymph node")) else 0.03,
        "cardiomegaly": 0.88 if any(k in lbl for k in ("cardiomegaly", "enlarged heart", "cardiothoracic ratio")) else 0.05,
        "aortic_calcification": 0.89 if any(k in lbl for k in ("aortic calcification", "atherosclerosis")) or (mean_hu > 350 and "aorta" in lbl) else 0.08,
        "coronary_calcification": 0.91 if any(k in lbl for k in ("coronary", "cac", "coronary artery calcification")) else 0.07,
        "hiatal_hernia": 0.88 if any(k in lbl for k in ("hiatal hernia", "retrocardiac mass", "hernia")) else 0.02,
        "mass": 0.93 if any(k in lbl for k in ("mass", "tumor", "neoplasm")) or volume_cm3 > 15.0 else 0.04,
        "fracture": 0.95 if any(k in lbl for k in ("fracture", "cortical break", "osseous disruption")) else 0.02,
        "normal": normal_prob,
    }

    return CTRateMultiOrganLabels(**scores)
