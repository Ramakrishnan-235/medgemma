import uuid
import pytest
from app.db.models import Case, SourceFile


@pytest.mark.asyncio
async def test_qa_run_rejects_source_from_another_case_in_same_workspace(
    async_client, db_session, workspace_a_ids, workspace_a_headers,
):
    workspace_id, user_id = workspace_a_ids

    case_1 = Case(workspace_id=workspace_id, patient_code="PT-001", title="Case 1", created_by=user_id)
    case_2 = Case(workspace_id=workspace_id, patient_code="PT-002", title="Case 2", created_by=user_id)
    db_session.add_all([case_1, case_2])
    await db_session.flush()

    source_in_case_2 = SourceFile(
        workspace_id=workspace_id,
        case_id=case_2.id,
        filename="notes_case_2.pdf",
        file_kind="pdf",
        storage_key="test/key2",
        sha256_hash="b" * 64,
        mime_type="application/pdf",
        byte_size=1234,
        parse_status="ready",
    )
    db_session.add(source_in_case_2)
    await db_session.commit()

    payload = {
        "question": "What are the clinical findings?",
        "selected_source_ids": [str(source_in_case_2.id)],
    }
    response = await async_client.post(
        f"/api/v1/cases/{case_1.id}/runs/qa",
        json=payload,
        headers=workspace_a_headers,
    )
    assert response.status_code == 400
    assert "One or more selected source files do not belong to this case" in response.json()["detail"]


@pytest.mark.asyncio
async def test_qa_run_rejects_source_from_another_workspace(
    async_client, db_session, workspace_a_ids, workspace_b_ids, workspace_a_headers,
):
    ws_a_id, user_a_id = workspace_a_ids
    ws_b_id, user_b_id = workspace_b_ids

    case_a = Case(workspace_id=ws_a_id, patient_code="PT-A", title="Case A", created_by=user_a_id)
    case_b = Case(workspace_id=ws_b_id, patient_code="PT-B", title="Case B", created_by=user_b_id)
    db_session.add_all([case_a, case_b])
    await db_session.flush()

    source_in_ws_b = SourceFile(
        workspace_id=ws_b_id,
        case_id=case_b.id,
        filename="ws_b_imaging.png",
        file_kind="image_png",
        storage_key="test/key_b",
        sha256_hash="c" * 64,
        mime_type="image/png",
        byte_size=2048,
        parse_status="ready",
    )
    db_session.add(source_in_ws_b)
    await db_session.commit()

    payload = {
        "question": "Cross-workspace leak attempt?",
        "selected_source_ids": [str(source_in_ws_b.id)],
    }
    response = await async_client.post(
        f"/api/v1/cases/{case_a.id}/runs/qa",
        json=payload,
        headers=workspace_a_headers,
    )
    assert response.status_code == 400
    assert "One or more selected source files do not belong to this case" in response.json()["detail"]


@pytest.mark.asyncio
async def test_qa_run_rejects_nonexistent_source_id(
    async_client, db_session, workspace_a_ids, workspace_a_headers,
):
    ws_id, user_id = workspace_a_ids
    case = Case(workspace_id=ws_id, patient_code="PT-VALID", title="Valid Case", created_by=user_id)
    db_session.add(case)
    await db_session.commit()

    random_id = uuid.uuid4()
    payload = {
        "question": "What is the diagnosis?",
        "selected_source_ids": [str(random_id)],
    }
    response = await async_client.post(
        f"/api/v1/cases/{case.id}/runs/qa",
        json=payload,
        headers=workspace_a_headers,
    )
    assert response.status_code == 400
    assert "One or more selected source files do not belong to this case" in response.json()["detail"]


@pytest.mark.asyncio
async def test_qa_run_accepts_valid_source_belonging_to_case(
    async_client, db_session, workspace_a_ids, workspace_a_headers,
):
    ws_id, user_id = workspace_a_ids
    case = Case(workspace_id=ws_id, patient_code="PT-OK", title="Authorized Case", created_by=user_id)
    db_session.add(case)
    await db_session.flush()

    valid_source = SourceFile(
        workspace_id=ws_id,
        case_id=case.id,
        filename="chest_xray.png",
        file_kind="image_png",
        storage_key="test/ok_key",
        sha256_hash="d" * 64,
        mime_type="image/png",
        byte_size=4096,
        parse_status="ready",
    )
    db_session.add(valid_source)
    await db_session.commit()

    payload = {
        "question": "Are lung fields clear?",
        "selected_source_ids": [str(valid_source.id)],
    }
    response = await async_client.post(
        f"/api/v1/cases/{case.id}/runs/qa",
        json=payload,
        headers=workspace_a_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "queued"
    assert data["task_type"] == "chat_qa"
