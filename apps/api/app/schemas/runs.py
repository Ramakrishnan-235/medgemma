import uuid
from datetime import datetime
from typing import Annotated, Any, Literal
from pydantic import BaseModel, Field


class ChatQARunInput(BaseModel):
    task_type: Literal["chat_qa"] = "chat_qa"
    question: str = Field(..., min_length=3, max_length=4000)
    selected_source_ids: list[uuid.UUID] = Field(default_factory=list)


class EHRSummaryRunInput(BaseModel):
    task_type: Literal["ehr_summary"] = "ehr_summary"
    selected_source_ids: list[uuid.UUID] = Field(default_factory=list)


class XrayAnalysisRunInput(BaseModel):
    task_type: Literal["xray_analysis"] = "xray_analysis"
    source_file_id: uuid.UUID
    clinical_indication: str = Field(default="Evaluate chest radiograph.", max_length=1000)


class XrayComparisonRunInput(BaseModel):
    task_type: Literal["xray_longitudinal"] = "xray_longitudinal"
    prior_source_file_id: uuid.UUID
    current_source_file_id: uuid.UUID
    clinical_question: str = Field(default="Evaluate interval changes.", max_length=1000)


class DocumentExtractionRunInput(BaseModel):
    task_type: Literal["document_extraction"] = "document_extraction"
    source_file_id: uuid.UUID | None = None
    target_fields: list[str] = Field(default_factory=lambda: ["date", "specimen", "hemoglobin", "wbc", "platelets"])


RunCreateInput = Annotated[
    ChatQARunInput | EHRSummaryRunInput | XrayAnalysisRunInput | XrayComparisonRunInput | DocumentExtractionRunInput,
    Field(discriminator="task_type"),
]


class RunResponse(BaseModel):
    id: uuid.UUID
    case_id: uuid.UUID
    workspace_id: uuid.UUID
    task_type: str
    status: str
    model_checkpoint: str
    processor_version: str
    created_at: datetime
    completed_at: datetime | None = None
    output_json: dict[str, Any] | None = None
    metrics_json: dict[str, Any] = Field(default_factory=dict)
    error_detail: str | None = None


class RunStatusUpdate(BaseModel):
    status: Literal["cancelled"] = Field(..., description="Action to cancel active run")

