"""Persist an AI run and its dispatch record in the same transaction."""

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.models import AIRun, Case, JobOutbox


async def queue_ai_run(
    db: AsyncSession,
    *,
    case: Case,
    user_id: uuid.UUID,
    task_type: str,
    task_name: str,
    prompt_version: str,
    source_ids: list[uuid.UUID],
    input_payload: dict[str, Any],
) -> AIRun:
    run = AIRun(
        id=uuid.uuid4(),
        workspace_id=case.workspace_id,
        case_id=case.id,
        task_type=task_type,
        status="queued",
        model_checkpoint=settings.MEDGEMMA_CHECKPOINT,
        processor_version=settings.MEDGEMMA_PROCESSOR_VERSION,
        prompt_template_version=prompt_version,
        input_source_ids=source_ids,
        input_payload_json=input_payload,
        created_by=user_id,
    )
    outbox = JobOutbox(
        aggregate_type="ai_run",
        aggregate_id=run.id,
        celery_task_name=f"app.workers.tasks.{task_name}",
        queue_name="interactive",
        payload_json={
            "workspace_id": str(case.workspace_id),
            "case_id": str(case.id),
            "run_id": str(run.id),
        },
    )
    db.add(run)
    db.add(outbox)
    await db.commit()
    return run
