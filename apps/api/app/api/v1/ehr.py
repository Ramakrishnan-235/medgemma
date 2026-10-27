import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthenticatedPrincipal, get_authorized_case, get_current_principal
from app.core.storage import storage_adapter
from app.db.models import Case, EvidenceChunk, SourceFile
from app.services.run_queue import queue_ai_run
from app.db.session import get_db
from app.services.ehr_summarizer import TwoPassEHRSummarizer

router = APIRouter(prefix="/cases/{case_id}", tags=["ehr-summarization"])


class CreateEHRSummaryRunRequest(BaseModel):
    selected_source_ids: list[uuid.UUID] = Field(default_factory=list)


class CitationInspectionResponse(BaseModel):
    evidence_chunk_id: uuid.UUID
    source_file_id: uuid.UUID
    filename: str
    encounter_date: str | None
    page_or_frame: int
    bbox_norm: dict[str, float] | None
    section_type: str
    verbatim_text: str
    page_preview_url: str | None


@router.post("/runs/ehr-summary", status_code=status.HTTP_201_CREATED)
async def create_ehr_summary_run(
    req: CreateEHRSummaryRunRequest,
    case: Case = Depends(get_authorized_case),
    principal: AuthenticatedPrincipal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> dict:
    # Verify all selected_source_ids belong strictly to this case & workspace
    if req.selected_source_ids:
        stmt = select(func.count(SourceFile.id)).where(
            SourceFile.case_id == case.id,
            SourceFile.workspace_id == case.workspace_id,
            SourceFile.id.in_(req.selected_source_ids),
        )
        matched_count = (await db.execute(stmt)).scalar_one()
        if matched_count != len(set(req.selected_source_ids)):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="One or more selected source files do not belong to this case.",
            )

    ai_run = await queue_ai_run(
        db, case=case, user_id=principal.user_id,
        task_type="ehr_summary", task_name="execute_ehr_summary_task",
        prompt_version=TwoPassEHRSummarizer.PROMPT_TEMPLATE_VERSION,
        source_ids=req.selected_source_ids,
        input_payload={"workflow": "two_pass_chronological_ehr"},
    )

    return {
        "run_id": str(ai_run.id),
        "status": "queued",
        "task_type": "ehr_summary",
        "events_url": f"/api/v1/cases/{case.id}/runs/{ai_run.id}/events",
    }


@router.get(
    "/evidence/{evidence_chunk_id}/citation-view",
    response_model=CitationInspectionResponse,
)
async def get_citation_source_highlight(
    evidence_chunk_id: uuid.UUID,
    case: Case = Depends(get_authorized_case),
    db: AsyncSession = Depends(get_db),
) -> CitationInspectionResponse:
    """
    Resolves any citation chip click to its exact document page preview URL
    and top-left normalized [0.0..1.0] bounding box coordinates.
    """
    stmt = (
        select(EvidenceChunk, SourceFile)
        .join(SourceFile, EvidenceChunk.source_file_id == SourceFile.id)
        .where(
            EvidenceChunk.id == evidence_chunk_id,
            EvidenceChunk.case_id == case.id,
            EvidenceChunk.workspace_id == case.workspace_id,
        )
    )
    row = (await db.execute(stmt)).first()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evidence chunk not found in this case.",
        )

    chunk, source = row
    metadata = source.metadata_json or {}
    preview_keys: dict[str, str] = metadata.get("page_preview_keys", {})
    preview_key = preview_keys.get(str(chunk.page_or_frame))
    presigned_preview = (
        storage_adapter.create_presigned_get_url(preview_key, expires_in=900)
        if preview_key
        else None
    )

    return CitationInspectionResponse(
        evidence_chunk_id=chunk.id,
        source_file_id=source.id,
        filename=source.filename,
        encounter_date=metadata.get("encounter_date"),
        page_or_frame=chunk.page_or_frame,
        bbox_norm=chunk.bbox_norm,
        section_type=chunk.section_type,
        verbatim_text=chunk.content_text,
        page_preview_url=presigned_preview,
    )
