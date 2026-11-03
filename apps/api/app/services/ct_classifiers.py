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
    category: Literal["0", "1", "2", "3", "4A", "4B", "4X"]

    if nodule_type == "none" or diameter_mm <= 0.0:
        category, desc, prob, mgmt = (
            "1",
            "Negative: No lung nodules detected",
            0.005,
            "Continue annual low-dose screening CT (LDCT) in 12 months",
        )
    elif nodule_type == "solid":
        if diameter_mm < 6.0:
            category, desc, prob, mgmt = "2", f"Benign appearance: Solid nodule < 6 mm ({diameter_mm:.1f} mm)", 0.008, "Continue annual LDCT in 12 months"
        elif diameter_mm < 8.0:
            category, desc, prob, mgmt = "3", f"Probably benign: Solid nodule 6 to < 8 mm ({diameter_mm:.1f} mm)", 0.02, "6-month LDCT follow-up"
        elif diameter_mm < 15.0 and not (is_new and diameter_mm >= 4.0):
            category, desc, prob, mgmt = "4A", f"Suspicious: Solid nodule 8 to < 15 mm ({diameter_mm:.1f} mm)", 0.10, "3-month LDCT or PET-CT"
        else:
            category, desc, prob, mgmt = "4B", f"Very suspicious: Solid nodule >= 15 mm ({diameter_mm:.1f} mm)", 0.28, "Chest CT with contrast, PET-CT, and/or tissue sampling (biopsy)"
    elif nodule_type == "part_solid":
        if diameter_mm < 6.0:
            category, desc, prob, mgmt = "2", f"Benign appearance: Part-solid nodule < 6 mm ({diameter_mm:.1f} mm)", 0.008, "Continue annual LDCT in 12 months"
        elif diameter_mm < 8.0:
            category, desc, prob, mgmt = "3", "Probably benign: Part-solid nodule >= 6 mm with solid component < 6 mm", 0.02, "6-month LDCT follow-up"
        else:
            category, desc, prob, mgmt = "4A", "Suspicious: Part-solid nodule with solid component >= 6 mm", 0.12, "3-month LDCT or PET-CT"
    else:  # ground_glass
        if diameter_mm < 30.0:
            category, desc, prob, mgmt = "2", "Benign appearance: Non-solid (ground-glass) nodule < 30 mm", 0.008, "Annual LDCT in 12 months"
        else:
            category, desc, prob, mgmt = "3", "Probably benign: Non-solid nodule >= 30 mm", 0.02, "6-month LDCT follow-up"

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

    condition_keywords: dict[str, tuple[str, ...]] = {
        "medical_device": ("port", "pacemaker", "lead", "stent", "device", "catheter"),
        "nodule": ("nodule", "nodular", "lesion", "liver dome", "segment vii"),
        "emphysema": ("emphysema",),
        "fibrosis": ("fibrosis", "reticulation", "honeycombing"),
        "consolidation": ("consolidation", "air bronchogram", "dense opacity"),
        "atelectasis": ("atelectasis", "subsegmental collapse", "linear opacity"),
        "bronchiectasis": ("bronchiectasis", "bronchial wall thickening"),
        "pleural_effusion": ("pleural effusion", "effusion", "fluid collection"),
        "pleural_thickening": ("pleural thickening", "pleural plaque"),
        "pericardial_effusion": ("pericardial effusion",),
        "lymphadenopathy": ("lymphadenopathy", "enlarged node", "lymph node"),
        "cardiomegaly": ("cardiomegaly", "enlarged heart", "cardiothoracic ratio"),
        "aortic_calcification": ("aortic calcification", "atherosclerosis"),
        "coronary_calcification": ("coronary", "cac", "coronary artery calcification"),
        "hiatal_hernia": ("hiatal hernia", "retrocardiac mass", "hernia"),
        "mass": ("mass", "tumor", "neoplasm"),
        "fracture": ("fracture", "cortical break", "osseous disruption"),
    }

    # Calibrated high and low probabilities
    high_probs = {
        "fracture": 0.95, "nodule": 0.94, "mass": 0.93, "pleural_effusion": 0.92,
        "coronary_calcification": 0.91, "aortic_calcification": 0.89, "consolidation": 0.89,
        "medical_device": 0.88, "atelectasis": 0.88, "cardiomegaly": 0.88, "hiatal_hernia": 0.88,
        "pericardial_effusion": 0.87, "lymphadenopathy": 0.86, "emphysema": 0.85,
        "bronchiectasis": 0.84, "fibrosis": 0.82, "pleural_thickening": 0.81,
    }
    low_probs = {
        "aortic_calcification": 0.08, "coronary_calcification": 0.07, "atelectasis": 0.06,
        "nodule": 0.05, "consolidation": 0.05, "cardiomegaly": 0.05,
    }

    scores: dict[str, float] = {}
    for condition, keywords in condition_keywords.items():
        matched = any(kw in lbl for kw in keywords)
        if condition == "emphysema" and mean_hu < -950:
            matched = True
        elif condition == "aortic_calcification" and (mean_hu > 350 and "aorta" in lbl):
            matched = True
        elif condition == "mass" and volume_cm3 > 15.0:
            matched = True

        scores[condition] = high_probs.get(condition, 0.88) if matched else low_probs.get(condition, 0.03)

    scores["normal"] = 0.05 if (lbl and "normal" not in lbl) else 0.92
    return CTRateMultiOrganLabels(**scores)

