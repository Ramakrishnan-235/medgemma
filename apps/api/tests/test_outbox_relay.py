import uuid
from unittest.mock import MagicMock

import pytest

from app.db.models import JobOutbox
from app.workers.outbox_relay import relay_outbox_batch


@pytest.mark.asyncio
async def test_relay_outbox_batch_dispatches_pending_jobs(db_session, monkeypatch):
    mock_send_task = MagicMock()
    monkeypatch.setattr("app.workers.outbox_relay.celery_app.send_task", mock_send_task)

    job1 = JobOutbox(
        aggregate_type="ai_run",
        aggregate_id=uuid.uuid4(),
        celery_task_name="app.workers.tasks.execute_grounded_qa_task",
        queue_name="interactive",
        payload_json={"run_id": str(uuid.uuid4()), "stage": "qa"},
        dispatched=False,
        attempts=0,
    )
    job2 = JobOutbox(
        aggregate_type="source_file",
        aggregate_id=uuid.uuid4(),
        celery_task_name="app.workers.tasks.ingest_source_file_task",
        queue_name="bulk",
        payload_json={"file_id": str(uuid.uuid4())},
        dispatched=False,
        attempts=0,
    )
    db_session.add_all([job1, job2])
    await db_session.commit()

    dispatched = await relay_outbox_batch()
    assert dispatched == 2
    assert mock_send_task.call_count == 2

    mock_send_task.assert_any_call(
        "app.workers.tasks.execute_grounded_qa_task",
        kwargs=job1.payload_json,
        queue="interactive",
        task_id=str(job1.id),
    )
    mock_send_task.assert_any_call(
        "app.workers.tasks.ingest_source_file_task",
        kwargs=job2.payload_json,
        queue="bulk",
        task_id=str(job2.id),
    )

    await db_session.refresh(job1)
    await db_session.refresh(job2)
    assert job1.dispatched is True
    assert job1.attempts == 1
    assert job1.dispatched_at is not None
    assert job2.dispatched is True
    assert job2.attempts == 1
    assert job2.dispatched_at is not None


@pytest.mark.asyncio
async def test_relay_outbox_batch_empty_table(db_session, monkeypatch):
    mock_send_task = MagicMock()
    monkeypatch.setattr("app.workers.outbox_relay.celery_app.send_task", mock_send_task)

    count = await relay_outbox_batch()
    assert count == 0
    mock_send_task.assert_not_called()


@pytest.mark.asyncio
async def test_relay_outbox_batch_handles_dispatch_error(db_session, monkeypatch):
    mock_send_task = MagicMock(side_effect=RuntimeError("Celery broker connection failed"))
    monkeypatch.setattr("app.workers.outbox_relay.celery_app.send_task", mock_send_task)

    job = JobOutbox(
        aggregate_type="ai_run",
        aggregate_id=uuid.uuid4(),
        celery_task_name="app.workers.tasks.execute_grounded_qa_task",
        queue_name="interactive",
        payload_json={"run_id": str(uuid.uuid4())},
        dispatched=False,
        attempts=0,
    )
    db_session.add(job)
    await db_session.commit()

    dispatched = await relay_outbox_batch()
    assert dispatched == 0
    assert mock_send_task.call_count == 1

    await db_session.refresh(job)
    assert job.dispatched is False
    assert job.attempts == 1
