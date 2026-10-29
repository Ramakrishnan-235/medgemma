import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthenticatedPrincipal, get_authorized_case, get_current_principal
from app.core.storage import storage_adapter
from app.db.models import Case, EvidenceChunk, JobOutbox, ReportVersion
from app.db.session import get_db

router = APIRouter(prefix="/cases/{case_id}/reports", tags=["reports"])


class SaveReportVersionRequest(BaseModel):
    source_run_id: uuid.UUID | None = None
    tiptap_doc_json: dict[str, Any]


class ReportVersionResponse(BaseModel):
    id: uuid.UUID
    version_number: int
    review_status: str
    source_run_id: uuid.UUID | None
    tiptap_doc_json: dict[str, Any]
    citations_snapshot_json: list[dict[str, Any]]
    reviewed_by: uuid.UUID | None
    export_download_url: str | None = None
    created_at: str


def extract_citation_chips_from_tiptap(node: dict[str, Any]) -> list[dict[str, Any]]:
    """
    Recursively walks a Tiptap JSON AST to collect all inline citationChip attrs.
    """
    collected: list[dict[str, Any]] = []
    if node.get("type") == "citationChip" and isinstance(node.get("attrs"), dict):
        collected.append(node["attrs"])
    for child in node.get("content", []) or []:
        if isinstance(child, dict):
            collected.extend(extract_citation_chips_from_tiptap(child))
    return collected


def _serialize_version(ver: ReportVersion) -> ReportVersionResponse:
    download_url = (
        storage_adapter.create_presigned_get_url(ver.export_storage_key, expires_in=900)
        if ver.export_storage_key
        else None
    )
    return ReportVersionResponse(
        id=ver.id,
        version_number=ver.version_number,
        review_status=ver.review_status,
        source_run_id=ver.source_run_id,
        tiptap_doc_json=ver.tiptap_doc_json,
        citations_snapshot_json=ver.citations_snapshot_json,
        reviewed_by=ver.reviewed_by,
        export_download_url=download_url,
        created_at=ver.created_at.isoformat(),
    )


@router.get("/versions", response_model=list[ReportVersionResponse])
async def list_report_versions(
    case: Case = Depends(get_authorized_case),
    db: AsyncSession = Depends(get_db),
) -> list[ReportVersionResponse]:
    stmt = (
        select(ReportVersion)
        .where(
            ReportVersion.case_id == case.id,
            ReportVersion.workspace_id == case.workspace_id,
        )
        .order_by(ReportVersion.version_number.desc())
    )
    rows = (await db.execute(stmt)).scalars().all()
    return [_serialize_version(r) for r in rows]


@router.post(
    "/versions",
    response_model=ReportVersionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_immutable_report_version(
    req: SaveReportVersionRequest,
    case: Case = Depends(get_authorized_case),
    principal: AuthenticatedPrincipal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> ReportVersionResponse:
    raw_chips = extract_citation_chips_from_tiptap(req.tiptap_doc_json)
    chunk_ids: set[uuid.UUID] = set()
    for c in raw_chips:
        raw_id = c.get("evidenceChunkId")
        if raw_id:
            try:
                chunk_ids.add(uuid.UUID(str(raw_id)))
            except (ValueError, TypeError):
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail=f"Invalid evidenceChunkId UUID format: '{raw_id}'",
                )

    # Verify every cited EvidenceChunk belongs strictly to this case & workspace
    verified_Snapshots: list[dict[str, Any]] = []
    if chunk_ids:
        stmt = select(EvidenceChunk).where(
            EvidenceChunk.case_id == case.id,
            EvidenceChunk.workspace_id == case.workspace_id,
            EvidenceChunk.id.in_(chunk_ids),
        )
        valid_chunks = {c.id: c for c in (await db.execute(stmt)).scalars().all()}
        if len(valid_chunks) != len(chunk_ids):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Report contains citation chips referencing unauthorized or missing evidence chunks.",
            )
        for chip in raw_chips:
            cid = uuid.UUID(str(chip["evidenceChunkId"]))
            chunk_row = valid_chunks[cid]
            verified_Snapshots.append(
                {
                    "citation_id": chip.get("citationId", "cit"),
                    "evidence_chunk_id": str(chunk_row.id),
                    "source_file_id": str(chunk_row.source_file_id),
                    "page_or_frame": chunk_row.page_or_frame,
                    "bbox_norm": chunk_row.bbox_norm,
                    "verbatim_quote": chunk_row.content_text[:240],
                }
            )

    for attempt in range(3):
        max_stmt = select(func.coalesce(func.max(ReportVersion.version_number), 0)).where(
            ReportVersion.case_id == case.id,
            ReportVersion.workspace_id == case.workspace_id,
        )
        next_ver = (await db.execute(max_stmt)).scalar_one() + 1

        new_version = ReportVersion(
            workspace_id=case.workspace_id,
            case_id=case.id,
            version_number=next_ver,
            source_run_id=req.source_run_id,
            tiptap_doc_json=req.tiptap_doc_json,
            citations_snapshot_json=verified_Snapshots,
            review_status="draft",
            created_by=principal.user_id,
        )
        db.add(new_version)
        try:
            await db.commit()
            await db.refresh(new_version)
            return _serialize_version(new_version)
        except IntegrityError:
            await db.rollback()
            if attempt == 2:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Concurrent modification conflict while saving draft report.",
                )


@router.post("/versions/{version_number}/review", response_model=ReportVersionResponse)
async def mark_report_version_reviewed(
    version_number: int,
    case: Case = Depends(get_authorized_case),
    principal: AuthenticatedPrincipal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> ReportVersionResponse:
    stmt = select(ReportVersion).where(
        ReportVersion.case_id == case.id,
        ReportVersion.workspace_id == case.workspace_id,
        ReportVersion.version_number == version_number,
    )
    ver = (await db.execute(stmt)).scalar_one_or_none()
    if ver is None:
        raise HTTPException(status_code=404, detail="Report version not found.")

    ver.review_status = "reviewed"
    ver.reviewed_by = principal.user_id
    await db.commit()
    await db.refresh(ver)
    return _serialize_version(ver)


@router.post("/versions/{version_number}/export-pdf", status_code=status.HTTP_202_ACCEPTED)
async def trigger_report_pdf_export(
    version_number: int,
    case: Case = Depends(get_authorized_case),
    db: AsyncSession = Depends(get_db),
) -> dict:
    stmt = select(ReportVersion).where(
        ReportVersion.case_id == case.id,
        ReportVersion.workspace_id == case.workspace_id,
        ReportVersion.version_number == version_number,
    )
    ver = (await db.execute(stmt)).scalar_one_or_none()
    if ver is None:
        raise HTTPException(status_code=404, detail="Report version not found.")

    if ver.review_status not in ("reviewed", "exported"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Report version must be marked as 'reviewed' before exporting to PDF.",
        )

    outbox_id = uuid.uuid4()
    outbox = JobOutbox(
        id=outbox_id,
        aggregate_type="report_export",
        aggregate_id=ver.id,
        celery_task_name="app.workers.tasks.export_report_pdf_task",
        queue_name="interactive",
        payload_json={
            "workspace_id": str(case.workspace_id),
            "case_id": str(case.id),
            "report_version_id": str(ver.id),
        },
    )
    db.add(outbox)
    await db.commit()
    return {
        "report_version_id": str(ver.id),
        "version_number": ver.version_number,
        "outbox_job_id": str(outbox_id),
        "status": "export_queued",
    }
