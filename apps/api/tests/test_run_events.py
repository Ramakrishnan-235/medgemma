from unittest.mock import AsyncMock, MagicMock

import pytest
from redis.exceptions import ConnectionError

from app.db.models import Case
from app.services.run_queue import queue_ai_run


async def seed_run(db, workspace_ids):
    workspace_id, user_id = workspace_ids
    case = Case(workspace_id=workspace_id, created_by=user_id, patient_code="SSE-TEST", title="Synthetic SSE")
    db.add(case)
    await db.commit()
    run = await queue_ai_run(
        db, case=case, user_id=user_id, task_type="chat_qa",
        task_name="execute_grounded_qa_task", prompt_version="test", source_ids=[], input_payload={},
    )
    return case, run


@pytest.mark.asyncio
async def test_sse_still_returns_database_snapshot_when_redis_subscribe_fails(
    async_client, db_session, workspace_a_ids, monkeypatch,
):
    case, run = await seed_run(db_session, workspace_a_ids)
    run.status = "completed"
    run.output_json = {"answer_markdown": "Durable synthetic output"}
    await db_session.commit()
    pubsub = AsyncMock()
    pubsub.subscribe.side_effect = ConnectionError("Redis unavailable")
    redis = AsyncMock()
    redis.pubsub = MagicMock(return_value=pubsub)
    monkeypatch.setattr("app.api.v1.runs.aioredis.from_url", lambda *args, **kwargs: redis)
    response = await async_client.get(f"/api/v1/cases/{case.id}/runs/{run.id}/events")
    assert response.status_code == 200
    assert "event: snapshot" in response.text
    assert "Durable synthetic output" in response.text
    pubsub.aclose.assert_awaited_once()
    redis.aclose.assert_awaited_once()


@pytest.mark.asyncio
async def test_cancellation_stays_successful_when_redis_and_revoke_fail(
    async_client, db_session, workspace_a_ids, monkeypatch,
):
    case, run = await seed_run(db_session, workspace_a_ids)
    monkeypatch.setattr(
        "app.workers.recovery.aioredis.from_url",
        MagicMock(side_effect=ConnectionError("Redis unavailable")),
    )
    monkeypatch.setattr(
        "app.workers.recovery.celery_app.control.revoke",
        MagicMock(side_effect=RuntimeError("Broker unavailable")),
    )
    monkeypatch.setattr("app.workers.recovery.publish_run_event", AsyncMock())
    response = await async_client.post(f"/api/v1/cases/{case.id}/runs/{run.id}/cancel")
    assert response.status_code == 200
    assert response.json()["status"] == "cancelled"
    await db_session.refresh(run)
    assert run.status == "cancelled"
