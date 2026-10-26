import uuid
from datetime import datetime, timedelta, timezone

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_authorized_case
from app.core.config import settings
from app.db.models import AIRun, Case, JobOutbox, SourceFile
from app.db.session import AsyncSessionLocal, get_db
from app.workers.tasks import celery_app, publish_run_event

router = APIRouter(prefix="/cases/{case_id}", tags=["cancellation-and-recovery"])


@router.post("/runs/{run_id}/cancel")
async def cancel_active_run(
    run_id: uuid.UUID,
    case: Case = Depends(get_authorized_case),
    db: AsyncSession = Depends(get_db),
) -> dict:
    stmt = select(AIRun).where(
        AIRun.id == run_id,
        AIRun.case_id == case.id,
        AIRun.workspace_id == case.workspace_id,
    )
    run = (await db.execute(stmt)).scalar_one_or_none()
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found in this case.")

    if run.status in ("completed", "failed", "cancelled"):
        return {"run_id": str(run.id), "status": run.status}

    # 1. Update authoritative state in PostgreSQL
    run.status = "cancelled"
    run.error_detail = "Cancelled by reviewer."
    run.completed_at = datetime.now(timezone.utc)

    # 2. Find matching JobOutbox entry to revoke Celery task ID
    outbox_stmt = select(JobOutbox).where(
        JobOutbox.aggregate_type == "ai_run",
        JobOutbox.aggregate_id == run.id,
    )
    outbox_row = (await db.execute(outbox_stmt)).scalar_one_or_none()
    await db.commit()

    # 3. Set cooperative Redis cancellation key & revoke Celery task
    r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    await r.setex(f"cancel_run:{run.id}", 3600, "1")
    await r.aclose()

    if outbox_row:
        celery_app.control.revoke(str(outbox_row.id), terminate=False)

    await publish_run_event(
        run.id,
        "cancelled",
        {"status": "cancelled", "error_detail": "Cancelled by reviewer."},
    )
    return {"run_id": str(run.id), "status": "cancelled"}


async def recover_stalled_runs_and_files(stale_minutes: int = 10) -> dict[str, int]:
    """
    Periodic watchdog task executed every 60s to recover jobs orphaned by
    worker restarts or GPU timeouts.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=stale_minutes)
    recovered_runs = 0
    requeued_files = 0

    async with AsyncSessionLocal() as db:
        # 1. Mark stalled AI runs as failed so clients can retry cleanly
        stalled_runs_stmt = select(AIRun).where(
            AIRun.status.in_(["queued", "running"]),
            AIRun.created_at < cutoff,
        )
        for run in (await db.execute(stalled_runs_stmt)).scalars().all():
            run.status = "failed"
            run.error_detail = (
                f"Watchdog recovery: job exceeded {stale_minutes}m TTL (worker restart or GPU timeout)."
            )
            run.completed_at = datetime.now(timezone.utc)
            recovered_runs += 1
            await publish_run_event(
                run.id,
                "failed",
                {"status": "failed", "error_detail": run.error_detail},
            )

        # 2. Re-queue idempotent file ingestion jobs stuck in 'processing'
        stalled_files_stmt = select(SourceFile).where(
            SourceFile.parse_status == "processing",
            SourceFile.created_at < cutoff,
        )
        for src in (await db.execute(stalled_files_stmt)).scalars().all():
            src.parse_status = "queued"
            db.add(
                JobOutbox(
                    aggregate_type="source_file",
                    aggregate_id=src.id,
                    celery_task_name="app.workers.tasks.ingest_source_file_task",
                    queue_name="bulk",
                    payload_json={
                        "workspace_id": str(src.workspace_id),
                        "case_id": str(src.case_id),
                        "source_file_id": str(src.id),
                    },
                )
            )
            requeued_files += 1

        await db.commit()

    return {"recovered_runs": recovered_runs, "requeued_files": requeued_files}
