import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthenticatedPrincipal, get_authorized_case, get_current_principal
from app.core.config import settings
from app.core.storage import storage_adapter
from app.db.models import AIRun, Case, ImageAnnotation, JobOutbox, SourceFile
from app.db.session import get_db
from app.services.xray_analyzer import ChestXrayAnalysisService

router = APIRouter(prefix="/cases/{case_id}/imaging", tags=["imaging"])


class NormalizedBoxModel(BaseModel):
    x0: float = Field(..., ge=0.0, le=1.0)
    y0: float = Field(..., ge=0.0, le=1.0)
    x1: float = Field(..., ge=0.0, le=1.0)
    y1: float = Field(..., ge=0.0, le=1.0)

    @model_validator(mode="after")
    def validate_bounds(self) -> "NormalizedBoxModel":
        if self.x1 <= self.x0 or self.y1 <= self.y0:
            raise ValueError("x1 and y1 must be strictly greater than x0 and y0 respectively.")
        return self


class CreateManualAnnotationRequest(BaseModel):
    source_file_id: uuid.UUID
    anatomical_label: str = Field(..., min_length=2, max_length=128)
    finding_text: str | None = Field(default=None, max_length=1000)
    bbox_norm: NormalizedBoxModel


class UpdateAnnotationReviewRequest(BaseModel):
    review_state: str = Field(..., pattern="^(accepted|rejected|pending_review)$")
    anatomical_label: str | None = Field(default=None, min_length=2, max_length=128)
    finding_text: str | None = Field(default=None, max_length=1000)


class TriggerSingleXrayRequest(BaseModel):
    source_file_id: uuid.UUID
    clinical_indication: str = Field(default="Evaluate chest radiograph.", max_length=1000)


class TriggerLongitudinalXrayRequest(BaseModel):
    prior_source_file_id: uuid.UUID
    current_source_file_id: uuid.UUID
    clinical_question: str = Field(
        default="Evaluate interval changes between prior and current studies.",
        max_length=1000,
    )


@router.get("/studies/{source_file_id}/viewer-manifest")
async def get_xray_viewer_manifest(
    source_file_id: uuid.UUID,
    case: Case = Depends(get_authorized_case),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Returns short-lived presigned URLs for both the original DICOM/PNG file and
    the normalized display PNG, plus DICOM windowing metadata and saved annotations.
    """
    stmt = select(SourceFile).where(
        SourceFile.id == source_file_id,
        SourceFile.case_id == case.id,
        SourceFile.workspace_id == case.workspace_id,
    )
    source = (await db.execute(stmt)).scalar_one_or_none()
    if source is None:
        raise HTTPException(status_code=404, detail="Imaging study not found in this case.")

    ann_stmt = (
        select(ImageAnnotation)
        .where(
            ImageAnnotation.source_file_id == source.id,
            ImageAnnotation.case_id == case.id,
            ImageAnnotation.workspace_id == case.workspace_id,
        )
        .order_by(ImageAnnotation.created_at.asc())
    )
    annotations = (await db.execute(ann_stmt)).scalars().all()

    raw_url = storage_adapter.create_presigned_get_url(source.storage_key, expires_in=900)
    display_key = source.metadata_json.get("display_png_key")
    display_url = (
        storage_adapter.create_presigned_get_url(display_key, expires_in=900)
        if display_key
        else raw_url
    )

    return {
        "source_file_id": str(source.id),
        "filename": source.filename,
        "file_kind": source.file_kind,
        "raw_dicom_or_image_url": raw_url,
        "normalized_display_png_url": display_url,
        "metadata": source.metadata_json,
        "annotations": [
            {
                "id": str(a.id),
                "origin": a.origin,
                "anatomical_label": a.anatomical_label,
                "finding_text": a.finding_text,
                "bbox_norm": a.bbox_norm,
                "review_state": a.review_state,
            }
            for a in annotations
        ],
    }


@router.post("/annotations", status_code=status.HTTP_201_CREATED)
async def create_manual_annotation(
    req: CreateManualAnnotationRequest,
    case: Case = Depends(get_authorized_case),
    principal: AuthenticatedPrincipal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> dict:
    stmt = select(SourceFile).where(
        SourceFile.id == req.source_file_id,
        SourceFile.case_id == case.id,
        SourceFile.workspace_id == case.workspace_id,
    )
    if (await db.execute(stmt)).scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Imaging study not found in this case.")

    ann = ImageAnnotation(
        workspace_id=case.workspace_id,
        case_id=case.id,
        source_file_id=req.source_file_id,
        origin="manual",
        anatomical_label=req.anatomical_label,
        finding_text=req.finding_text,
        bbox_norm=req.bbox_norm.model_dump(),
        review_state="accepted",
        created_by=principal.user_id,
    )
    db.add(ann)
    await db.commit()
    await db.refresh(ann)
    return {
        "id": str(ann.id),
        "origin": ann.origin,
        "anatomical_label": ann.anatomical_label,
        "finding_text": ann.finding_text,
        "bbox_norm": ann.bbox_norm,
        "review_state": ann.review_state,
    }


@router.patch("/annotations/{annotation_id}")
async def review_or_update_annotation(
    annotation_id: uuid.UUID,
    req: UpdateAnnotationReviewRequest,
    case: Case = Depends(get_authorized_case),
    db: AsyncSession = Depends(get_db),
) -> dict:
    stmt = select(ImageAnnotation).where(
        ImageAnnotation.id == annotation_id,
        ImageAnnotation.case_id == case.id,
        ImageAnnotation.workspace_id == case.workspace_id,
    )
    ann = (await db.execute(stmt)).scalar_one_or_none()
    if ann is None:
        raise HTTPException(status_code=404, detail="Annotation not found.")

    ann.review_state = req.review_state
    if req.anatomical_label is not None:
        ann.anatomical_label = req.anatomical_label
    if req.finding_text is not None:
        ann.finding_text = req.finding_text
    await db.commit()
    return {"id": str(ann.id), "review_state": ann.review_state}


@router.post("/runs/analyze-single", status_code=status.HTTP_201_CREATED)
async def trigger_single_xray_run(
    req: TriggerSingleXrayRequest,
    case: Case = Depends(get_authorized_case),
    principal: AuthenticatedPrincipal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> dict:
    stmt = select(SourceFile).where(
        SourceFile.id == req.source_file_id,
        SourceFile.case_id == case.id,
        SourceFile.workspace_id == case.workspace_id,
    )
    if (await db.execute(stmt)).scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Imaging study not found in this case.")

    run_id = uuid.uuid4()
    ai_run = AIRun(
        id=run_id,
        workspace_id=case.workspace_id,
        case_id=case.id,
        task_type="xray_analysis",
        status="queued",
        model_checkpoint=settings.MEDGEMMA_CHECKPOINT,
        processor_version=settings.MEDGEMMA_PROCESSOR_VERSION,
        prompt_template_version=ChestXrayAnalysisService.SINGLE_PROMPT_VERSION,
        input_source_ids=[req.source_file_id],
        input_payload_json={
            "source_file_id": str(req.source_file_id),
            "clinical_indication": req.clinical_indication,
        },
        created_by=principal.user_id,
    )
    outbox = JobOutbox(
        aggregate_type="ai_run",
        aggregate_id=run_id,
        celery_task_name="app.workers.tasks.execute_xray_analysis_task",
        queue_name="interactive",
        payload_json={
            "workspace_id": str(case.workspace_id),
            "case_id": str(case.id),
            "run_id": str(run_id),
        },
    )
    db.add(ai_run)
    db.add(outbox)
    await db.commit()
    return {"run_id": str(run_id), "status": "queued", "task_type": "xray_analysis"}


@router.post("/runs/compare-longitudinal", status_code=status.HTTP_201_CREATED)
async def trigger_longitudinal_xray_run(
    req: TriggerLongitudinalXrayRequest,
    case: Case = Depends(get_authorized_case),
    principal: AuthenticatedPrincipal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> dict:
    if req.prior_source_file_id == req.current_source_file_id:
        raise HTTPException(
            status_code=400,
            detail="Prior and Current studies must be two distinct source files.",
        )

    stmt = select(SourceFile).where(
        SourceFile.case_id == case.id,
        SourceFile.workspace_id == case.workspace_id,
        SourceFile.id.in_([req.prior_source_file_id, req.current_source_file_id]),
    )
    sources = (await db.execute(stmt)).scalars().all()
    if len(sources) != 2:
        raise HTTPException(
            status_code=404,
            detail="Both Prior and Current studies must belong to this case.",
        )

    run_id = uuid.uuid4()
    ai_run = AIRun(
        id=run_id,
        workspace_id=case.workspace_id,
        case_id=case.id,
        task_type="xray_longitudinal",
        status="queued",
        model_checkpoint=settings.MEDGEMMA_CHECKPOINT,
        processor_version=settings.MEDGEMMA_PROCESSOR_VERSION,
        prompt_template_version=ChestXrayAnalysisService.LONGITUDINAL_PROMPT_VERSION,
        input_source_ids=[req.prior_source_file_id, req.current_source_file_id],
        input_payload_json={
            "prior_source_file_id": str(req.prior_source_file_id),
            "current_source_file_id": str(req.current_source_file_id),
            "clinical_question": req.clinical_question,
        },
        created_by=principal.user_id,
    )
    outbox = JobOutbox(
        aggregate_type="ai_run",
        aggregate_id=run_id,
        celery_task_name="app.workers.tasks.execute_longitudinal_xray_task",
        queue_name="interactive",
        payload_json={
            "workspace_id": str(case.workspace_id),
            "case_id": str(case.id),
            "run_id": str(run_id),
        },
    )
    db.add(ai_run)
    db.add(outbox)
    await db.commit()
    return {"run_id": str(run_id), "status": "queued", "task_type": "xray_longitudinal"}
