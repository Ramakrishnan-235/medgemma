import asyncio
import json
import logging
import re
import uuid
from collections.abc import AsyncGenerator

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthenticatedPrincipal, get_authorized_case, get_current_principal
from app.core.config import settings
from app.db.models import AIRun, Case, JobOutbox, ReportVersion, SourceFile
from app.db.session import AsyncSessionLocal, get_db
from app.services.medgemma_adapter import MedGemmaAdapter

logger = logging.getLogger("runs")
router = APIRouter(prefix="/cases/{case_id}", tags=["runs-and-reports"])

TERMINAL_RUN_STATES = {"completed", "failed", "cancelled"}


class CreateGroundedQARunRequest(BaseModel):
    question: str = Field(..., min_length=3, max_length=4000)
    selected_source_ids: list[uuid.UUID] = Field(default_factory=list)


class RunSummaryResponse(BaseModel):
    run_id: uuid.UUID
    status: str
    task_type: str
    output_json: dict | None = None
    metrics_json: dict = Field(default_factory=dict)


class SaveDraftFromRunResponse(BaseModel):
    report_version_id: uuid.UUID
    case_id: uuid.UUID
    version_number: int
    review_status: str
    tiptap_doc_json: dict


@router.post("/runs/qa", response_model=RunSummaryResponse, status_code=status.HTTP_201_CREATED)
async def create_grounded_qa_run(
    req: CreateGroundedQARunRequest,
    case: Case = Depends(get_authorized_case),
    principal: AuthenticatedPrincipal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> RunSummaryResponse:
    # Verify all selected_source_ids belong strictly to this case & workspace
    if req.selected_source_ids:
        stmt = select(func.count(SourceFile.id)).where(
            SourceFile.case_id == case.id,
            SourceFile.workspace_id == case.workspace_id,
            SourceFile.id.in_(req.selected_source_ids),
        )
        matched_count = (await db.execute(stmt)).scalar_one()
        if matched_count != len(set(req.selected_source_ids)):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="One or more selected source files do not belong to this case.",
            )

    run_id = uuid.uuid4()
    ai_run = AIRun(
        id=run_id,
        workspace_id=case.workspace_id,
        case_id=case.id,
        task_type="chat_qa",
        status="queued",
        model_checkpoint=settings.MEDGEMMA_CHECKPOINT,
        processor_version=settings.MEDGEMMA_PROCESSOR_VERSION,
        prompt_template_version=MedGemmaAdapter.PROMPT_TEMPLATE_VERSION,
        input_source_ids=req.selected_source_ids,
        input_payload_json={"question": req.question},
        created_by=principal.user_id,
    )
    outbox = JobOutbox(
        aggregate_type="ai_run",
        aggregate_id=run_id,
        celery_task_name="app.workers.tasks.execute_grounded_qa_task",
        queue_name="interactive",
        payload_json={
            "workspace_id": str(case.workspace_id),
            "case_id": str(case.id),
            "run_id": str(run_id),
        },
    )
    db.add(ai_run)
    db.add(outbox)
    await db.commit()

    return RunSummaryResponse(
        run_id=ai_run.id,
        status=ai_run.status,
        task_type=ai_run.task_type,
        output_json=ai_run.output_json,
        metrics_json=ai_run.metrics_json,
    )


@router.get("/runs/{run_id}/events")
async def stream_run_events(
    run_id: uuid.UUID,
    request: Request,
    case: Case = Depends(get_authorized_case),
) -> StreamingResponse:
    """
    Reload-resilient SSE stream:
    1. Subscribes to Redis channel first.
    2. Emits authoritative PostgreSQL snapshot immediately.
    3. Polls PostgreSQL as fallback every 5s in case a Redis notification was lost.
    """
    async def event_generator() -> AsyncGenerator[str, None]:
        redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        pubsub = redis_client.pubsub()
        channel = f"run_events:{run_id}"
        await pubsub.subscribe(channel)

        try:
            async with AsyncSessionLocal() as db:
                stmt = select(AIRun).where(
                    AIRun.id == run_id,
                    AIRun.case_id == case.id,
                    AIRun.workspace_id == case.workspace_id,
                )
                run = (await db.execute(stmt)).scalar_one_or_none()
                if run is None:
                    yield f"event: error\ndata: {json.dumps({'detail': 'Run not found'})}\n\n"
                    return

                snapshot = {
                    "event": "snapshot",
                    "run_id": str(run.id),
                    "status": run.status,
                    "output_json": run.output_json,
                    "metrics_json": run.metrics_json,
                    "error_detail": run.error_detail,
                }
                yield f"event: snapshot\ndata: {json.dumps(snapshot)}\n\n"

                if run.status in TERMINAL_RUN_STATES:
                    return

            # Stream live updates with periodic DB reconciliation fallback
            while not await request.is_disconnected():
                msg = await pubsub.get_message(ignore_subscribe_messages=True, timeout=5.0)
                if msg and msg.get("data"):
                    try:
                        payload = json.loads(msg["data"])
                        ev_name = payload.get("event", "status")
                        yield f"event: {ev_name}\ndata: {json.dumps(payload)}\n\n"
                        if payload.get("status") in TERMINAL_RUN_STATES:
                            return
                    except (json.JSONDecodeError, TypeError):
                        pass
                else:
                    # Heartbeat + authoritative PostgreSQL fallback check
                    yield ": heartbeat\n\n"
                    async with AsyncSessionLocal() as db:
                        stmt = select(AIRun).where(AIRun.id == run_id)
                        current_run = (await db.execute(stmt)).scalar_one_or_none()
                        if current_run and current_run.status in TERMINAL_RUN_STATES:
                            fallback_payload = {
                                "event": current_run.status,
                                "run_id": str(current_run.id),
                                "status": current_run.status,
                                "output_json": current_run.output_json,
                                "metrics_json": current_run.metrics_json,
                                "error_detail": current_run.error_detail,
                            }
                            yield f"event: {current_run.status}\ndata: {json.dumps(fallback_payload)}\n\n"
                            return
        finally:
            try:
                await pubsub.unsubscribe(channel)
                await pubsub.aclose()
                await redis_client.aclose()
            except Exception:
                pass

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Prevents Caddy/Nginx response buffering
        },
    )


def build_tiptap_doc_with_citations(answer_markdown: str, citations: list[dict]) -> dict:
    """
    Converts grounded markdown containing [cit_X] markers into a structured
    Tiptap document where each [cit_X] becomes an interactive citation chip node
    carrying source_file_id, page_or_frame, and bbox_norm.
    """
    cit_map = {c.get("citation_id"): c for c in citations if isinstance(c, dict)}
    tokens = re.split(r"(\[cit_\d+\])", answer_markdown)
    paragraph_content: list[dict] = []

    for token in tokens:
        if not token:
            continue
        match = re.fullmatch(r"\[(cit_\d+)\]", token)
        if match and match.group(1) in cit_map:
            cit = cit_map[match.group(1)]
            paragraph_content.append(
                {
                    "type": "citationChip",
                    "attrs": {
                        "citationId": str(cit.get("citation_id", "")),
                        "evidenceChunkId": str(cit.get("evidence_chunk_id", "")),
                        "sourceFileId": str(cit.get("source_file_id", "")),
                        "pageOrFrame": int(cit.get("page_or_frame", 1)),
                        "bboxNorm": cit.get("bbox_norm"),
                        "verbatimQuote": str(cit.get("verbatim_quote", "")),
                    },
                }
            )
        else:
            paragraph_content.append({"type": "text", "text": token})

    return {
        "type": "doc",
        "content": [
            {
                "type": "paragraph",
                "content": paragraph_content or [{"type": "text", "text": ""}],
            }
        ],
    }


@router.post(
    "/runs/{run_id}/save-draft",
    response_model=SaveDraftFromRunResponse,
    status_code=status.HTTP_201_CREATED,
)
async def save_report_draft_from_run(
    run_id: uuid.UUID,
    case: Case = Depends(get_authorized_case),
    principal: AuthenticatedPrincipal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> SaveDraftFromRunResponse:
    stmt = select(AIRun).where(
        AIRun.id == run_id,
        AIRun.case_id == case.id,
        AIRun.workspace_id == case.workspace_id,
    )
    run = (await db.execute(stmt)).scalar_one_or_none()
    if run is None or run.status != "completed" or not run.output_json:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only completed runs with verified output can be saved as a report draft.",
        )

    max_ver_stmt = select(func.coalesce(func.max(ReportVersion.version_number), 0)).where(
        ReportVersion.case_id == case.id
    )
    next_version = (await db.execute(max_ver_stmt)).scalar_one() + 1

    citations = run.output_json.get("citations", [])
    tiptap_doc = build_tiptap_doc_with_citations(
        answer_markdown=run.output_json.get("answer_markdown", ""),
        citations=citations,
    )

    report_version = ReportVersion(
        workspace_id=case.workspace_id,
        case_id=case.id,
        version_number=next_version,
        source_run_id=run.id,
        tiptap_doc_json=tiptap_doc,
        citations_snapshot_json=citations,
        review_status="draft",
        created_by=principal.user_id,
    )
    db.add(report_version)
    await db.commit()
    await db.refresh(report_version)

    return SaveDraftFromRunResponse(
        report_version_id=report_version.id,
        case_id=case.id,
        version_number=report_version.version_number,
        review_status=report_version.review_status,
        tiptap_doc_json=report_version.tiptap_doc_json,
    )
