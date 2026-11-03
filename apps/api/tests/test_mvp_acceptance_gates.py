import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import AIRun, Case, EvidenceChunk, SourceFile
from app.services.ehr_summarizer import TwoPassEHRSummarizer


@pytest.mark.asyncio
async def test_cross_workspace_zero_leakage(
    async_client: AsyncClient,
    db_session: AsyncSession,
    workspace_a_headers: dict[str, str],
    workspace_b_headers: dict[str, str],
    workspace_a_ids: tuple[uuid.UUID, uuid.UUID],
) -> None:
    """
    Gate 1: Another workspace or case cannot access or probe foreign case data.
    """
    ws_a_id, user_a_id = workspace_a_ids
    case_a = Case(
        workspace_id=ws_a_id,
        patient_code="PT-A100",
        title="Workspace A Confidential Case",
        created_by=user_a_id,
    )
    db_session.add(case_a)
    await db_session.commit()

    # Workspace B attempts to fetch Workspace A's case -> must return 404 (not 403)
    resp_b = await async_client.get(
        f"/api/v1/cases/{case_a.id}/reports/versions",
        headers=workspace_b_headers,
    )
    assert resp_b.status_code == 404


@pytest.mark.asyncio
async def test_sse_snapshot_recovers_when_redis_notification_lost(
    async_client: AsyncClient,
    db_session: AsyncSession,
    workspace_a_headers: dict[str, str],
    workspace_a_ids: tuple[uuid.UUID, uuid.UUID],
) -> None:
    """
    Gate 2: Workflow survives browser reloads and lost Redis notifications because
    PostgreSQL is authoritative for run state and outputs.
    """
    ws_a_id, user_a_id = workspace_a_ids
    case = Case(
        workspace_id=ws_a_id,
        patient_code="PT-RELOAD",
        title="Reload Resilience Case",
        created_by=user_a_id,
    )
    db_session.add(case)
    await db_session.flush()

    completed_run = AIRun(
        workspace_id=ws_a_id,
        case_id=case.id,
        task_type="chat_qa",
        status="completed",
        model_checkpoint="google/medgemma-1.5-4b-it",
        processor_version="1.5.0-896px",
        prompt_template_version="v1.0",
        input_source_ids=[],
        output_json={
            "answer_markdown": "Right lower lobe consolidation [cit_1].",
            "citations": [{"citation_id": "cit_1", "page_or_frame": 1}],
        },
        created_by=user_a_id,
    )
    db_session.add(completed_run)
    await db_session.commit()

    # Simulate browser reload connecting to SSE stream AFTER Redis event already passed
    resp = await async_client.get(
        f"/api/v1/cases/{case.id}/runs/{completed_run.id}/events",
        headers=workspace_a_headers,
    )
    assert resp.status_code == 200
    assert "event: snapshot" in resp.text
    assert "Right lower lobe consolidation [cit_1]." in resp.text


@pytest.mark.asyncio
async def test_unverified_citations_stripped_and_valid_citations_reopen_bbox(
    async_client: AsyncClient,
    db_session: AsyncSession,
    workspace_a_headers: dict[str, str],
    workspace_a_ids: tuple[uuid.UUID, uuid.UUID],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """
    Gate 3: Hallucinated citation keys ([cit_99]) are rejected; valid citations resolve
    to the exact document page and normalized bounding box.
    """
    ws_a_id, user_a_id = workspace_a_ids
    case = Case(workspace_id=ws_a_id, patient_code="PT-CIT", title="Citation Test", created_by=user_a_id)
    db_session.add(case)
    await db_session.flush()

    src = SourceFile(
        workspace_id=ws_a_id,
        case_id=case.id,
        filename="discharge_summary.pdf",
        file_kind="pdf",
        storage_key=f"workspaces/{ws_a_id}/cases/{case.id}/sources/s1.pdf",
        sha256_hash="a" * 64,
        mime_type="application/pdf",
        byte_size=10240,
        parse_status="ready",
    )
    db_session.add(src)
    await db_session.flush()

    expected_bbox = {"x0": 0.12, "y0": 0.34, "x1": 0.88, "y1": 0.42}
    chunk = EvidenceChunk(
        workspace_id=ws_a_id,
        case_id=case.id,
        source_file_id=src.id,
        page_or_frame=2,
        bbox_norm=expected_bbox,
        section_type="medications",
        content_text="Patient discharged on Apixaban 5mg twice daily.",
        embedding=[0.01] * 384,
    )
    db_session.add(chunk)
    await db_session.commit()

    # Reopen the citation via the inspection endpoint
    cit_resp = await async_client.get(
        f"/api/v1/cases/{case.id}/evidence/{chunk.id}/citation-view",
        headers=workspace_a_headers,
    )
    assert cit_resp.status_code == 200
    cit_data = cit_resp.json()
    assert cit_data["page_or_frame"] == 2
    assert cit_data["bbox_norm"] == expected_bbox
    assert "Apixaban 5mg" in cit_data["verbatim_text"]


@pytest.mark.asyncio
async def test_ehr_summary_retains_explicit_missing_information_state(
    db_session: AsyncSession,
    workspace_a_ids: tuple[uuid.UUID, uuid.UUID],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """
    Gate 4: Missing clinical categories (e.g., Allergies) must explicitly state
    missing_information=True rather than hallucinating 'NKDA'.
    """
    ws_a_id, user_a_id = workspace_a_ids
    case = Case(workspace_id=ws_a_id, patient_code="PT-EHR", title="EHR Gate", created_by=user_a_id)
    db_session.add(case)
    await db_session.flush()

    src = SourceFile(
        workspace_id=ws_a_id,
        case_id=case.id,
        filename="progress_note.pdf",
        file_kind="pdf",
        storage_key=f"workspaces/{ws_a_id}/cases/{case.id}/sources/note.pdf",
        sha256_hash="b" * 64,
        mime_type="application/pdf",
        byte_size=4096,
        parse_status="ready",
    )
    db_session.add(src)
    await db_session.flush()

    chunk = EvidenceChunk(
        workspace_id=ws_a_id,
        case_id=case.id,
        source_file_id=src.id,
        page_or_frame=1,
        bbox_norm={"x0": 0.1, "y0": 0.1, "x1": 0.9, "y1": 0.2},
        section_type="problems",
        content_text="Assessment: Community-acquired pneumonia.",
        embedding=[0.02] * 384,
    )
    db_session.add(chunk)
    await db_session.commit()

    summarizer = TwoPassEHRSummarizer()

    async def _mock_medgemma_json(system_instruction: str, user_prompt: str, max_new_tokens: int = 1024):
        if "Extract ONLY explicitly stated clinical facts" in system_instruction:
            return (
                {
                    "facts": [
                        {
                            "category": "problems",
                            "statement": "Community-acquired pneumonia",
                            "status_or_severity": "Active",
                            "encounter_date": "2026-10-20",
                            "citation_id": "cit_1",
                        },
                        # Hallucinated allergy with invalid citation_id must be dropped
                        {
                            "category": "allergies",
                            "statement": "No known drug allergies",
                            "status_or_severity": None,
                            "encounter_date": None,
                            "citation_id": "cit_999",
                        },
                    ]
                },
                {"inference_ms": 15},
            )
        return ({"problems": "- Community-acquired pneumonia [cit_1]"}, {"inference_ms": 10})

    monkeypatch.setattr(summarizer, "_call_medgemma_json", _mock_medgemma_json)
    summary = await summarizer.execute_two_pass_summary(
        db=db_session, workspace_id=ws_a_id, case_id=case.id
    )

    assert summary.sections["problems"].missing_information is False
    assert summary.sections["allergies"].missing_information is True
    assert summary.sections["allergies"].summary_markdown == "No documented evidence in selected sources."


@pytest.mark.asyncio
async def test_immutable_report_versioning_and_review_export_gate(
    async_client: AsyncClient,
    db_session: AsyncSession,
    workspace_a_headers: dict[str, str],
    workspace_a_ids: tuple[uuid.UUID, uuid.UUID],
) -> None:
    """
    Gate 5: Report edits save as a new immutable version (v1 -> v2), and PDF export
    is blocked with 409 Conflict until that version is marked 'reviewed'.
    """
    ws_a_id, user_a_id = workspace_a_ids
    case = Case(workspace_id=ws_a_id, patient_code="PT-REP", title="Report Gate", created_by=user_a_id)
    db_session.add(case)
    await db_session.commit()

    # Create v1 draft
    doc_v1 = {"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Draft v1"}]}]}
    r1 = await async_client.post(
        f"/api/v1/cases/{case.id}/reports/versions",
        json={"tiptap_doc_json": doc_v1},
        headers=workspace_a_headers,
    )
    assert r1.status_code == 201
    assert r1.json()["version_number"] == 1

    # Save edited v2 draft
    doc_v2 = {"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Edited Draft v2"}]}]}
    r2 = await async_client.post(
        f"/api/v1/cases/{case.id}/reports/versions",
        json={"tiptap_doc_json": doc_v2},
        headers=workspace_a_headers,
    )
    assert r2.status_code == 201
    assert r2.json()["version_number"] == 2

    # Attempting to export unreviewed v2 must fail with 409 Conflict
    export_unreviewed = await async_client.post(
        f"/api/v1/cases/{case.id}/reports/versions/2/export-pdf",
        headers=workspace_a_headers,
    )
    assert export_unreviewed.status_code == 409

    # Mark v2 reviewed -> export succeeds with 202 Accepted
    rev_resp = await async_client.post(
        f"/api/v1/cases/{case.id}/reports/versions/2/review",
        headers=workspace_a_headers,
    )
    assert rev_resp.status_code == 200
    assert rev_resp.json()["review_status"] == "reviewed"

    export_reviewed = await async_client.post(
        f"/api/v1/cases/{case.id}/reports/versions/2/export-pdf",
        headers=workspace_a_headers,
    )
    assert export_reviewed.status_code == 202
