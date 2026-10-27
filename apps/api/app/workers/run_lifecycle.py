"""One durable lifecycle for QA, EHR, and imaging jobs."""

import logging
import uuid
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
import redis.asyncio as aioredis

from app.core.config import settings
from app.db.models import AIRun

logger = logging.getLogger(__name__)
TERMINAL_RUN_STATES = frozenset({"completed", "failed", "cancelled"})


@dataclass(frozen=True)
class RunResult:
    output: dict[str, Any]
    metrics: dict[str, Any]


RunOperation = Callable[[AsyncSession, AIRun], Awaitable[RunResult]]
RunPublisher = Callable[[uuid.UUID, str, dict], Awaitable[None]]


async def is_run_cancelled(run_id: uuid.UUID, db: AsyncSession | None = None) -> bool:
    """
    Checks if an AI run was cooperatively cancelled via Redis or database status.
    """
    try:
        r = aioredis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            socket_timeout=1.0,
            socket_connect_timeout=1.0,
        )
        try:
            val = await r.get(f"cancel_run:{run_id}")
            if val is not None:
                return True
        finally:
            await r.aclose()
    except Exception as exc:
        logger.debug("Redis cancellation check error for %s: %s", run_id, exc)

    if db is not None:
        try:
            status_val = await db.scalar(select(AIRun.status).where(AIRun.id == run_id))
            if status_val == "cancelled":
                return True
        except Exception as exc:
            logger.debug("DB cancellation check error for %s: %s", run_id, exc)

    return False


async def execute_ai_run(
    db: AsyncSession,
    workspace_id: uuid.UUID,
    case_id: uuid.UUID,
    run_id: uuid.UUID,
    *,
    stage: str,
    operation: RunOperation,
    publish: RunPublisher,
) -> None:
    scope = (AIRun.id == run_id, AIRun.case_id == case_id, AIRun.workspace_id == workspace_id)
    run = (await db.execute(select(AIRun).where(*scope))).scalar_one_or_none()
    if run is None or run.status != "queued":
        return

    async def transition(expected: str, **values: Any) -> bool:
        # A concurrent cancellation/recovery must win over late worker output.
        result = await db.execute(
            update(AIRun).where(*scope, AIRun.status == expected)
            .values(**values).execution_options(synchronize_session=False)
        )
        if result.rowcount != 1:
            await db.rollback()
            return False
        await db.commit()
        return True

    if not await transition("queued", status="running", error_detail=None):
        return
    run.status = "running"

    if await is_run_cancelled(run_id, db):
        logger.info("Run %s cancelled before operation started.", run_id)
        return

    await publish(run_id, "status", {"status": "running", "stage": stage})
    try:
        result = await operation(db, run)
        if await transition(
            "running", status="completed", output_json=result.output,
            metrics_json=result.metrics, completed_at=datetime.now(timezone.utc),
        ):
            await publish(run_id, "completed", {
                "status": "completed", "output_json": result.output, "metrics_json": result.metrics,
            })
    except Exception as exc:
        # A failed flush leaves the session unusable until it is rolled back.
        await db.rollback()
        logger.exception("AI run execution failed for run %s: %s", run_id, exc)
        safe_error = (
            "The clinical analysis service encountered an error processing this request. "
            "Please try again or contact support."
        )
        try:
            if await transition(
                "running", status="failed", error_detail=safe_error,
                completed_at=datetime.now(timezone.utc),
            ):
                await publish(run_id, "failed", {"status": "failed", "error_detail": safe_error})
        except Exception:
            logger.exception("Could not persist failed state for run %s", run_id)
        raise
