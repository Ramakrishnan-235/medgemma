import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock

import pytest
from sqlalchemy import select

from app.db.models import AIRun, Case, JobOutbox, SourceFile
from app.workers.recovery import recover_stalled_runs_and_files


@pytest.mark.asyncio
async def test_recover_stalled_runs_and_files(db_session, monkeypatch):
    mock_publish = AsyncMock()
    monkeypatch.setattr("app.workers.recovery.publish_run_event", mock_publish)

    ws_id = uuid.uuid4()
    user_id = uuid.uuid4()
    case = Case(workspace_id=ws_id, patient_code="REC-001", title="Recovery Case", created_by=user_id)
    db_session.add(case)
    await db_session.flush()

    past_20m = datetime.now(timezone.utc) - timedelta(minutes=20)
    past_2m = datetime.now(timezone.utc) - timedelta(minutes=2)

    # 1. Stalled run (running, created 20m ago) -> should recover
    stalled_run_running = AIRun(
        workspace_id=ws_id,
        case_id=case.id,
        task_type="chat_qa",
        model_checkpoint="google/medgemma-1.5-4b-it",
        processor_version="1.5.0-896px",
        prompt_template_version="1.0",
        created_by=user_id,
        status="running",
        created_at=past_20m,
    )
    # 2. Stalled run (queued, created 20m ago) -> should recover
    stalled_run_queued = AIRun(
        workspace_id=ws_id,
        case_id=case.id,
        task_type="ehr_summary",
        model_checkpoint="google/medgemma-1.5-4b-it",
        processor_version="1.5.0-896px",
        prompt_template_version="1.0",
        created_by=user_id,
        status="queued",
        created_at=past_20m,
    )
    # 3. Active run (running, created 2m ago) -> should NOT recover
    active_run = AIRun(
        workspace_id=ws_id,
        case_id=case.id,
        task_type="chat_qa",
        model_checkpoint="google/medgemma-1.5-4b-it",
        processor_version="1.5.0-896px",
        prompt_template_version="1.0",
        created_by=user_id,
        status="running",
        created_at=past_2m,
    )
    # 4. Completed run (completed, created 20m ago) -> should NOT recover
    completed_run = AIRun(
        workspace_id=ws_id,
        case_id=case.id,
        task_type="chat_qa",
        model_checkpoint="google/medgemma-1.5-4b-it",
        processor_version="1.5.0-896px",
        prompt_template_version="1.0",
        created_by=user_id,
        status="completed",
        created_at=past_20m,
    )
    # 5. Stalled file (processing, created 20m ago) -> should requeue
    stalled_file = SourceFile(
        workspace_id=ws_id,
        case_id=case.id,
        filename="stalled.pdf",
        file_kind="pdf",
        storage_key="test/stalled",
        sha256_hash="e" * 64,
        mime_type="application/pdf",
        byte_size=1024,
        parse_status="processing",
        created_at=past_20m,
    )
    # 6. Active file (processing, created 2m ago) -> should NOT requeue
    active_file = SourceFile(
        workspace_id=ws_id,
        case_id=case.id,
        filename="active.pdf",
        file_kind="pdf",
        storage_key="test/active",
        sha256_hash="f" * 64,
        mime_type="application/pdf",
        byte_size=1024,
        parse_status="processing",
        created_at=past_2m,
    )
    # 7. Ready file (ready, created 20m ago) -> should NOT requeue
    ready_file = SourceFile(
        workspace_id=ws_id,
        case_id=case.id,
        filename="ready.pdf",
        file_kind="pdf",
        storage_key="test/ready",
        sha256_hash="1" * 64,
        mime_type="application/pdf",
        byte_size=1024,
        parse_status="ready",
        created_at=past_20m,
    )

    db_session.add_all([
        stalled_run_running, stalled_run_queued, active_run, completed_run,
        stalled_file, active_file, ready_file,
    ])
    await db_session.commit()

    report = await recover_stalled_runs_and_files(stale_minutes=10)

    assert report["recovered_runs"] == 2
    assert report["requeued_files"] == 1

    await db_session.refresh(stalled_run_running)
    await db_session.refresh(stalled_run_queued)
    await db_session.refresh(active_run)
    await db_session.refresh(completed_run)
    await db_session.refresh(stalled_file)
    await db_session.refresh(active_file)
    await db_session.refresh(ready_file)

    assert stalled_run_running.status == "failed"
    assert "Watchdog recovery" in stalled_run_running.error_detail
    assert stalled_run_running.completed_at is not None

    assert stalled_run_queued.status == "failed"
    assert "Watchdog recovery" in stalled_run_queued.error_detail
    assert stalled_run_queued.completed_at is not None

    assert active_run.status == "running"
    assert completed_run.status == "completed"

    assert stalled_file.parse_status == "queued"
    assert active_file.parse_status == "processing"
    assert ready_file.parse_status == "ready"

    # Verify outbox entry was created for stalled file
    outbox = (
        await db_session.execute(
            select(JobOutbox).where(JobOutbox.aggregate_id == stalled_file.id)
        )
    ).scalar_one_or_none()
    assert outbox is not None
    assert outbox.celery_task_name == "app.workers.tasks.ingest_source_file_task"
    assert outbox.queue_name == "bulk"
    assert outbox.payload_json["source_file_id"] == str(stalled_file.id)

    # Verify notifications published for both failed runs
    assert mock_publish.await_count == 2
