import uuid
from typing import Any, Literal
from pydantic import BaseModel, Field, model_validator


class NormalizedBox(BaseModel):
    x0: float = Field(..., ge=0.0, le=1.0)
    y0: float = Field(..., ge=0.0, le=1.0)
    x1: float = Field(..., ge=0.0, le=1.0)
    y1: float = Field(..., ge=0.0, le=1.0)

    @model_validator(mode="after")
    def validate_bounds(self) -> "NormalizedBox":
        if self.x1 <= self.x0 or self.y1 <= self.y0:
            raise ValueError("x1 and y1 must be strictly greater than x0 and y0 respectively.")
        return self


class ImageAnnotationResponse(BaseModel):
    id: uuid.UUID
    origin: str
    anatomical_label: str
    finding_text: str | None = None
    bbox_norm: NormalizedBox | dict[str, float]
    review_state: str


class StudyManifestResponse(BaseModel):
    source_file_id: uuid.UUID
    filename: str
    file_kind: str
    raw_dicom_or_image_url: str
    normalized_display_png_url: str
    metadata: dict[str, Any] = Field(default_factory=dict)
    annotations: list[ImageAnnotationResponse] = Field(default_factory=list)


ViewerManifestResponse = StudyManifestResponse

