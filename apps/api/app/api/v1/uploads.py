import asyncio
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_authorized_case
from app.core.storage import FileKind, storage_adapter
from app.db.models import Case, JobOutbox, SourceFile
from app.db.session import get_db

router = APIRouter(prefix="/cases/{case_id}/uploads", tags=["uploads"])


class PresignUploadRequest(BaseModel):
    filename: str = Field(..., min_length=1, max_length=255)
    file_kind: FileKind
    mime_type: str = Field(..., min_length=3, max_length=128)
    byte_size: int = Field(..., gt=0, le=524_288_000)  # Max 500 MB
    sha256_hash: str = Field(..., min_length=64, max_length=64)


class PresignUploadResponse(BaseModel):
    source_file_id: uuid.UUID
    storage_key: str
    presigned_put_url: str
    expires_in_seconds: int = 900


class CompleteUploadResponse(BaseModel):
    source_file_id: uuid.UUID
    parse_status: str
    verified_byte_size: int
    sha256_hash: str
    outbox_job_id: uuid.UUID


@router.post("/presign", response_model=PresignUploadResponse, status_code=status.HTTP_201_CREATED)
async def create_upload_grant(
    req: PresignUploadRequest,
    case: Case = Depends(get_authorized_case),
    db: AsyncSession = Depends(get_db),
) -> PresignUploadResponse:
    source_id = uuid.uuid4()
    safe_name = req.filename.replace("/", "_").replace("\\", "_")
    storage_key = f"workspaces/{case.workspace_id}/cases/{case.id}/sources/{source_id}/{safe_name}"

    put_url = storage_adapter.create_presigned_put_url(
        storage_key=storage_key,
        mime_type=req.mime_type,
        expires_in=900,
    )

    source_file = SourceFile(
        id=source_id,
        workspace_id=case.workspace_id,
        case_id=case.id,
        filename=safe_name,
        file_kind=req.file_kind,
        storage_key=storage_key,
        sha256_hash=req.sha256_hash.lower(),
        mime_type=req.mime_type,
        byte_size=req.byte_size,
        parse_status="upload_pending",
        parser_version="1.0.0",
    )
    db.add(source_file)
    await db.commit()

    return PresignUploadResponse(
        source_file_id=source_id,
        storage_key=storage_key,
        presigned_put_url=put_url,
    )


@router.post("/{source_file_id}/complete", response_model=CompleteUploadResponse)
async def complete_and_verify_upload(
    source_file_id: uuid.UUID,
    case: Case = Depends(get_authorized_case),
    db: AsyncSession = Depends(get_db),
) -> CompleteUploadResponse:
    stmt = select(SourceFile).where(
        SourceFile.id == source_file_id,
        SourceFile.case_id == case.id,
        SourceFile.workspace_id == case.workspace_id,
    )
    source_file = (await db.execute(stmt)).scalar_one_or_none()
    if source_file is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source file not found in this case.")

    # Offload blocking S3 network streaming and checksum calculation to thread pool
    verified = await asyncio.to_thread(
        storage_adapter.verify_uploaded_bytes,
        storage_key=source_file.storage_key,
        expected_sha256=source_file.sha256_hash,
        declared_kind=source_file.file_kind,  # type: ignore[arg-type]
    )

    outbox_id = uuid.uuid4()
    source_file.byte_size = verified.byte_size
    source_file.parse_status = "queued"

    outbox_job = JobOutbox(
        id=outbox_id,
        aggregate_type="source_file",
        aggregate_id=source_file.id,
        celery_task_name="app.workers.tasks.ingest_source_file_task",
        queue_name="bulk",
        payload_json={
            "workspace_id": str(case.workspace_id),
            "case_id": str(case.id),
            "source_file_id": str(source_file.id),
        },
    )
    db.add(outbox_job)
    await db.commit()

    return CompleteUploadResponse(
        source_file_id=source_file.id,
        parse_status=source_file.parse_status,
        verified_byte_size=verified.byte_size,
        sha256_hash=verified.sha256_hex,
        outbox_job_id=outbox_id,
    )
