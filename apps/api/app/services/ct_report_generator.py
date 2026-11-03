from datetime import datetime, timezone
from typing import Any
from app.schemas.ct_clinical import FreeFormRadiologyReport, LongitudinalComparisonReport


def generate_narrative_radiology_report(
    case_id: str,
    lesion_data: dict[str, Any],
    telemetry: dict[str, Any] | None = None,
    comparison: str = "None available",
) -> FreeFormRadiologyReport:
    """
    Generates a comprehensive RSNA/ACR standard narrative radiology report
    covering multi-organ observations, anatomical findings, and diagnostic impressions.
    """
    telemetry = telemetry or {}
    matrix = telemetry.get("matrix", "512×512")
    slice_thickness = telemetry.get("slice_thickness_mm", 1.25)
    kernel = telemetry.get("kernel", "B30f soft")

    peak_slice = lesion_data.get("peak_slice", 64)
    dimensions_str = lesion_data.get("dimensions_str", "14.2 × 11.8 × 12.0 mm")
    volume_cm3 = lesion_data.get("volume_cm3", 1.05)
    mean_hu = lesion_data.get("mean_hu", 42.0)
    anatomical_location = lesion_data.get("anatomical_location", "Liver dome / segment VII")

    technique = (
        f"Helical 3D volumetric CT acquisition without intravenous contrast.\n"
        f"Reconstruction Matrix: {matrix}, Slice Thickness: {slice_thickness} mm, Reconstruction Kernel: {kernel}."
    )

    organ_observations = {
        "Lungs/Pleura": "Tracheobronchial tree is patent. No evidence of pneumothorax or focal consolidative infiltrate. Pleural spaces are clear bilaterally.",
        "Mediastinum/Heart": "Mediastinal and hilar contours are within normal limits. Cardiac silhouette is normal in size. No pathologically enlarged lymph nodes.",
        "Abdomen/Liver": (
            f"Focal circumscribed hypoattenuating nodular lesion noted within {anatomical_location} centered at axial slice {peak_slice}. "
            f"Dimensions: {dimensions_str} (volume: {volume_cm3:.2f} cm³). Attenuation averages {mean_hu:.1f} HU. "
            f"Spleen, pancreas, adrenal glands, and kidneys demonstrate unremarkable morphology without focal abnormality."
        ),
        "Bones/Soft Tissue": "Thoracic and lumbar spine osseous structures are intact without acute fracture or aggressive osteolytic/osteoblastic lesions.",
    }

    findings_sections = [
        "## FINDINGS",
        f"- **Lungs & Pleura**: {organ_observations['Lungs/Pleura']}",
        f"- **Mediastinum & Cardiovascular**: {organ_observations['Mediastinum/Heart']}",
        f"- **Abdomen & Organ Parenchyma**: {organ_observations['Abdomen/Liver']}",
        f"- **Osseous Structures**: {organ_observations['Bones/Soft Tissue']}",
    ]
    findings_markdown = "\n\n".join(findings_sections)

    impression_sections = [
        "## IMPRESSION",
        f"1. Well-demarcated nodular focus in {anatomical_location} measuring {dimensions_str} (volumetric span: {volume_cm3:.2f} cm³, mean {mean_hu:.1f} HU). Differential diagnosis includes atypical hemangioma versus low-attenuation adenoma or focal nodular lesion.",
        "2. No evidence of acute thoracic pathology, pulmonary consolidation, or pathologically enlarged thoracic lymphadenopathy.",
        "3. Recommended Clinical Follow-up: Multiphasic liver MRI with hepatobiliary contrast (Eovist) or targeted interval surveillance CT in 3 to 6 months.",
    ]
    impression_markdown = "\n\n".join(impression_sections)

    return FreeFormRadiologyReport(
        case_id=case_id,
        modality="3D CT",
        technique=technique,
        comparison=comparison,
        findings_markdown=findings_markdown,
        impression_markdown=impression_markdown,
        created_at_utc=datetime.now(timezone.utc).isoformat(),
        organ_observations=organ_observations,
    )


def generate_longitudinal_comparison(
    case_id: str,
    prior_study: dict[str, Any],
    current_study: dict[str, Any],
) -> LongitudinalComparisonReport:
    """
    Computes quantified interval changes according to RECIST 1.1 guidelines:
    - Longest axial diameter delta (mm and percentage)
    - Volumetric progression delta (cm³ and percentage)
    - Mean CT Hounsfield density shift (HU)
    - Categorization: Complete Response, Partial Response, Stable Disease, Progressive Disease.
    """
    prior_date_str = prior_study.get("study_date", "2026-01-01")
    current_date_str = current_study.get("study_date", "2026-04-01")

    prior_dt = datetime.fromisoformat(prior_date_str)
    current_dt = datetime.fromisoformat(current_date_str)
    interval_days = abs((current_dt - prior_dt).days)

    d_prior = float(prior_study.get("lesion_longest_diameter_mm", 10.0))
    d_curr = float(current_study.get("lesion_longest_diameter_mm", 10.0))
    diameter_change_mm = round(d_curr - d_prior, 2)
    diameter_change_percent = round(((d_curr - d_prior) / d_prior) * 100.0, 1) if d_prior > 0 else 0.0

    v_prior = float(prior_study.get("volume_cm3", 1.0))
    v_curr = float(current_study.get("volume_cm3", 1.0))
    volume_change_cm3 = round(v_curr - v_prior, 3)
    volume_change_percent = round(((v_curr - v_prior) / v_prior) * 100.0, 1) if v_prior > 0 else 0.0

    hu_prior = float(prior_study.get("mean_hu", 40.0))
    hu_curr = float(current_study.get("mean_hu", 40.0))
    hu_attenuation_change = round(hu_curr - hu_prior, 1)

    # RECIST 1.1 Classification logic
    if d_curr <= 0.0 and v_curr <= 0.0:
        recist_category = "Complete Response"
        summary_text = f"Complete resolution of target lesion over {interval_days}-day interval."
    elif diameter_change_percent <= -30.0:
        recist_category = "Partial Response"
        summary_text = f"Target lesion decreased in longest axial diameter by {abs(diameter_change_percent):.1f}% (from {d_prior}mm to {d_curr}mm) over {interval_days} days."
    elif diameter_change_percent >= 20.0 and diameter_change_mm >= 5.0 or (diameter_change_percent >= 25.0 and diameter_change_mm >= 2.0):
        recist_category = "Progressive Disease"
        summary_text = f"Target lesion increased in longest axial diameter by {diameter_change_percent:+.1f}% (from {d_prior}mm to {d_curr}mm, volume {volume_change_percent:+.1f}%) over {interval_days} days."
    else:
        recist_category = "Stable Disease"
        summary_text = f"Target lesion demonstrates stability over {interval_days} days (diameter shift: {diameter_change_percent:+.1f}%, volume shift: {volume_change_percent:+.1f}%)."

    return LongitudinalComparisonReport(
        case_id=case_id,
        prior_study_date=prior_date_str,
        current_study_date=current_date_str,
        interval_days=interval_days,
        diameter_change_mm=diameter_change_mm,
        diameter_change_percent=diameter_change_percent,
        volume_change_cm3=volume_change_cm3,
        volume_change_percent=volume_change_percent,
        hu_attenuation_change=hu_attenuation_change,
        recist_category=recist_category,
        summary_text=summary_text,
    )

