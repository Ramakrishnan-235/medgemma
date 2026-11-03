from typing import Any, Literal
from pydantic import BaseModel, Field, model_validator


class NormalizedBox1000(BaseModel):
    """
    Spatial bounding box represented in 0..1000 integer normalized space
    [ymin, xmin, ymax, xmax].
    """
    ymin: int = Field(..., ge=0, le=1000, description="Top Y coordinate (0..1000)")
    xmin: int = Field(..., ge=0, le=1000, description="Left X coordinate (0..1000)")
    ymax: int = Field(..., ge=0, le=1000, description="Bottom Y coordinate (0..1000)")
    xmax: int = Field(..., ge=0, le=1000, description="Right X coordinate (0..1000)")

    @model_validator(mode="after")
    def validate_coordinates(self) -> "NormalizedBox1000":
        if self.ymax <= self.ymin:
            raise ValueError(f"ymax ({self.ymax}) must be strictly greater than ymin ({self.ymin}).")
        if self.xmax <= self.xmin:
            raise ValueError(f"xmax ({self.xmax}) must be strictly greater than xmin ({self.xmin}).")
        return self

    def to_normalized_float(self) -> tuple[float, float, float, float]:
        """Returns (ymin, xmin, ymax, xmax) in 0.0..1.0 float space."""
        return (
            round(self.ymin / 1000.0, 4),
            round(self.xmin / 1000.0, 4),
            round(self.ymax / 1000.0, 4),
            round(self.xmax / 1000.0, 4),
        )

    def to_cornerstone_dict(self) -> dict[str, float]:
        """Returns {x0, y0, x1, y1} for web canvas / Cornerstone viewport overlays."""
        y0, x0, y1, x1 = self.to_normalized_float()
        return {"x0": x0, "y0": y0, "x1": x1, "y1": y1}


class LungRadsAssessment(BaseModel):
    """
    ACR Lung-RADS v2022 assessment classification and malignancy risk score.
    """
    category: Literal["0", "1", "2", "3", "4A", "4B", "4X"]
    score_description: str
    malignancy_probability: float = Field(..., ge=0.0, le=1.0)
    recommended_management: str
    primary_nodule_size_mm: float | None = None
    nodule_type: Literal["solid", "part_solid", "ground_glass", "none"] = "solid"
    has_spiculation_or_high_risk: bool = False


class CTRateMultiOrganLabels(BaseModel):
    """
    18 multi-organ condition & abnormality labels from the CT-RATE benchmark.
    Scores represent calibrated probabilities in [0.0, 1.0].
    """
    medical_device: float = Field(default=0.0, ge=0.0, le=1.0)
    nodule: float = Field(default=0.0, ge=0.0, le=1.0)
    emphysema: float = Field(default=0.0, ge=0.0, le=1.0)
    fibrosis: float = Field(default=0.0, ge=0.0, le=1.0)
    consolidation: float = Field(default=0.0, ge=0.0, le=1.0)
    atelectasis: float = Field(default=0.0, ge=0.0, le=1.0)
    bronchiectasis: float = Field(default=0.0, ge=0.0, le=1.0)
    pleural_effusion: float = Field(default=0.0, ge=0.0, le=1.0)
    pleural_thickening: float = Field(default=0.0, ge=0.0, le=1.0)
    pericardial_effusion: float = Field(default=0.0, ge=0.0, le=1.0)
    lymphadenopathy: float = Field(default=0.0, ge=0.0, le=1.0)
    cardiomegaly: float = Field(default=0.0, ge=0.0, le=1.0)
    aortic_calcification: float = Field(default=0.0, ge=0.0, le=1.0)
    coronary_calcification: float = Field(default=0.0, ge=0.0, le=1.0)
    hiatal_hernia: float = Field(default=0.0, ge=0.0, le=1.0)
    mass: float = Field(default=0.0, ge=0.0, le=1.0)
    fracture: float = Field(default=0.0, ge=0.0, le=1.0)
    normal: float = Field(default=0.0, ge=0.0, le=1.0)

    def present_conditions(self, threshold: float = 0.5) -> list[str]:
        """Returns list of condition names whose predicted probability meets or exceeds threshold."""
        return [
            name
            for name, score in self.model_dump().items()
            if name != "normal" and score >= threshold
        ]


class FreeFormRadiologyReport(BaseModel):
    """
    RSNA-style free-form narrative radiology report from 3D CT axial volumes.
    """
    case_id: str
    modality: str = "3D CT"
    technique: str
    comparison: str = "None available"
    findings_markdown: str
    impression_markdown: str
    created_at_utc: str | None = None
    organ_observations: dict[str, str] = Field(default_factory=dict)


class LongitudinalComparisonReport(BaseModel):
    """
    Quantified comparison between prior and current CT scans (RECIST 1.1).
    """
    case_id: str
    prior_study_date: str
    current_study_date: str
    interval_days: int
    diameter_change_mm: float
    diameter_change_percent: float
    volume_change_cm3: float
    volume_change_percent: float
    hu_attenuation_change: float
    recist_category: Literal[
        "Complete Response",
        "Partial Response",
        "Stable Disease",
        "Progressive Disease",
        "Not Applicable",
    ]
    summary_text: str


class TargetedSliceVQARequest(BaseModel):
    """
    Natural language visual question answering inquiry targeting a specific axial slice and tissue window.
    Supports standard CT tissue windows as well as multi-sequence MRI presets.
    """
    case_id: str = "CASE-2026-0894"
    slice_index: int = Field(..., ge=1, le=512, description="Target axial slice (1..num_slices)")
    tissue_window: Literal[
        "soft_tissue", "lung", "bone", "liver", "mediastinum",
        "t2_weighted", "t1_weighted", "flair", "dwi_adc", "t1_contrast", "liver_dome"
    ] = "soft_tissue"
    question: str = Field(..., min_length=3, max_length=1000)


class TargetedSliceVQAResponse(BaseModel):
    """
    Clinically grounded answer to a targeted slice query.
    """
    slice_index: int
    question: str
    answer_markdown: str
    confidence_score: float = Field(..., ge=0.0, le=1.0)
    grounded_box: NormalizedBox1000 | None = None
    relevant_anatomical_regions: list[str] = Field(default_factory=list)


class VisualGroundingAnnotation(BaseModel):
    """
    Spatial visual grounding detection on a 3D CT slice.
    """
    id: str
    slice_index: int
    label: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    box_1000: NormalizedBox1000
    anatomical_region: str
    finding_type: str
    mean_hu: float | None = None
    dimensions_mm: str | None = None

