import uuid
from unittest.mock import AsyncMock

import pytest
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError

from app.db.models import AIRun, Case, JobOutbox, SourceFile
from app.services.run_queue import queue_ai_run
from app.workers.run_lifecycle import RunResult, execute_ai_run


async def queued_run(db):
    case = Case(
        workspace_id=uuid.uuid4(), patient_code="TEST-LIFECYCLE",
        title="Synthetic lifecycle test", created_by=uuid.uuid4(),
    )
    db.add(case)
    await db.commit()
    return await queue_ai_run(
        db, case=case, user_id=case.created_by, task_type="chat_qa",
        task_name="execute_grounded_qa_task", prompt_version="test",
        source_ids=[], input_payload={"question": "Synthetic evidence?"},
    )


@pytest.mark.asyncio
async def test_queue_persists_matching_outbox_and_worker_completes_once(db_session):
    run = await queued_run(db_session)
    ids = run.workspace_id, run.case_id, run.id
    outbox = (await db_session.execute(select(JobOutbox))).scalar_one()
    assert outbox.aggregate_id == run.id
    assert outbox.payload_json == dict(zip(
        ("workspace_id", "case_id", "run_id"), map(str, ids),
    ))
    assert outbox.celery_task_name == "app.workers.tasks.execute_grounded_qa_task"
    operation = AsyncMock(return_value=RunResult({"answer": "Synthetic"}, {"tokens": 2}))
    published_statuses = []

    async def publish(run_id, event, payload):
        # Every notification must follow the database commit.
        await db_session.refresh(run)
        assert run.status == payload["status"]
        published_statuses.append(event)

    await execute_ai_run(db_session, *ids, stage="generating", operation=operation, publish=publish)
    await execute_ai_run(db_session, *ids, stage="generating", operation=operation, publish=publish)
    await db_session.refresh(run)
    assert run.status == "completed"
    assert run.output_json == {"answer": "Synthetic"}
    assert run.completed_at is not None
    operation.assert_awaited_once()
    assert published_statuses == ["status", "completed"]


@pytest.mark.asyncio
@pytest.mark.parametrize("status", ["running", "completed", "failed", "cancelled"])
async def test_worker_does_not_restart_active_or_terminal_runs(db_session, status):
    run = await queued_run(db_session)
    run.status = status
    await db_session.commit()
    operation = AsyncMock()
    publish = AsyncMock()
    await execute_ai_run(
        db_session, run.workspace_id, run.case_id, run.id,
        stage="test", operation=operation, publish=publish,
    )
    operation.assert_not_awaited()
    publish.assert_not_awaited()


@pytest.mark.asyncio
@pytest.mark.parametrize("raises", [False, True])
async def test_cancellation_wins_over_late_output_or_error(db_session, raises):
    run = await queued_run(db_session)
    ids = run.workspace_id, run.case_id, run.id
    publish = AsyncMock()

    async def operation(db, _run):
        await db.execute(update(AIRun).where(AIRun.id == ids[2]).values(status="cancelled"))
        await db.commit()
        if raises:
            raise ValueError("Late model error")
        return RunResult({"answer": "Too late"}, {})

    if raises:
        with pytest.raises(ValueError, match="Late model error"):
            await execute_ai_run(db_session, *ids, stage="test", operation=operation, publish=publish)
    else:
        await execute_ai_run(db_session, *ids, stage="test", operation=operation, publish=publish)
    await db_session.refresh(run)
    assert run.status == "cancelled"
    assert run.output_json is None
    assert publish.await_count == 1


@pytest.mark.asyncio
async def test_database_failure_rolls_back_before_persisting_failed_state(db_session):
    run = await queued_run(db_session)
    ids = run.workspace_id, run.case_id, run.id

    async def operation(db, _run):
        db.add(Case(workspace_id=None, patient_code="INVALID", title="Invalid", created_by=uuid.uuid4()))
        await db.flush()

    with pytest.raises(IntegrityError):
        await execute_ai_run(db_session, *ids, stage="test", operation=operation, publish=AsyncMock())
    await db_session.refresh(run)
    assert run.status == "failed"
    assert run.error_detail


@pytest.mark.asyncio
async def test_worker_refuses_wrong_workspace(db_session):
    run = await queued_run(db_session)
    operation = AsyncMock()
    await execute_ai_run(
        db_session, uuid.uuid4(), run.case_id, run.id,
        stage="test", operation=operation, publish=AsyncMock(),
    )
    operation.assert_not_awaited()
    await db_session.refresh(run)
    assert run.status == "queued"


@pytest.mark.asyncio
@pytest.mark.parametrize(("endpoint", "task_type", "task_name"), [
    ("runs/qa", "chat_qa", "execute_grounded_qa_task"),
    ("runs/ehr-summary", "ehr_summary", "execute_ehr_summary_task"),
    ("imaging/runs/analyze-single", "xray_analysis", "execute_xray_analysis_task"),
    ("imaging/runs/compare-longitudinal", "xray_longitudinal", "execute_longitudinal_xray_task"),
])
async def test_all_run_endpoints_persist_their_dispatch_contract(
    async_client, db_session, workspace_a_ids, endpoint, task_type, task_name,
):
    workspace_id, user_id = workspace_a_ids
    case = Case(workspace_id=workspace_id, patient_code="QUEUE-TEST", title="Synthetic", created_by=user_id)
    db_session.add(case)
    await db_session.flush()
    sources = [SourceFile(
        workspace_id=workspace_id, case_id=case.id, filename=f"synthetic-{index}.png",
        file_kind="image_png", storage_key=f"synthetic/{index}", sha256_hash="a" * 64,
        mime_type="image/png", byte_size=100, parse_status="ready",
    ) for index in range(2)]
    db_session.add_all(sources)
    await db_session.commit()
    payload = {
        "question": "Synthetic findings?",
        "selected_source_ids": [str(sources[0].id)],
        "source_file_id": str(sources[0].id),
        "prior_source_file_id": str(sources[0].id),
        "current_source_file_id": str(sources[1].id),
    }
    response = await async_client.post(f"/api/v1/cases/{case.id}/{endpoint}", json=payload)
    assert response.status_code == 201, response.text
    run_id = uuid.UUID(response.json()["run_id"])
    run = (await db_session.execute(select(AIRun).where(AIRun.id == run_id))).scalar_one()
    outbox = (await db_session.execute(select(JobOutbox).where(JobOutbox.aggregate_id == run_id))).scalar_one()
    assert run.workspace_id == workspace_id
    assert run.case_id == case.id
    assert run.task_type == task_type
    assert run.status == "queued"
    assert outbox.celery_task_name == f"app.workers.tasks.{task_name}"
    assert outbox.payload_json["run_id"] == str(run_id)


@pytest.mark.asyncio
async def test_run_status_updated_to_running_in_memory_and_sanitized_errors(db_session):
    run = await queued_run(db_session)
    ids = run.workspace_id, run.case_id, run.id
    in_memory_status = None

    async def operation(db, active_run):
        nonlocal in_memory_status
        in_memory_status = active_run.status
        raise RuntimeError("Internal database password leaked: secret_123")

    with pytest.raises(RuntimeError):
        await execute_ai_run(db_session, *ids, stage="testing", operation=operation, publish=AsyncMock())

    assert in_memory_status == "running"
    await db_session.refresh(run)
    assert run.status == "failed"
    assert "secret_123" not in run.error_detail
    assert "clinical analysis service encountered an error" in run.error_detail


@pytest.mark.asyncio
async def test_is_run_cancelled_stops_before_operation(db_session, monkeypatch):
    run = await queued_run(db_session)
    ids = run.workspace_id, run.case_id, run.id

    mock_redis = AsyncMock()
    mock_redis.get = AsyncMock(return_value="1")
    mock_redis.aclose = AsyncMock()
    monkeypatch.setattr("app.workers.run_lifecycle.aioredis.from_url", lambda *args, **kwargs: mock_redis)

    operation = AsyncMock()
    publish = AsyncMock()

    await execute_ai_run(db_session, *ids, stage="testing", operation=operation, publish=publish)
    operation.assert_not_awaited()
