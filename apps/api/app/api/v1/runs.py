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
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthenticatedPrincipal, get_authorized_case, get_current_principal
from app.core.config import settings
from app.db.models import AIRun, Case, ReportVersion, SourceFile
from app.services.run_queue import queue_ai_run
from app.workers.run_lifecycle import TERMINAL_RUN_STATES
from app.db.session import AsyncSessionLocal, get_db
from app.services.medgemma_adapter import MedGemmaAdapter

logger = logging.getLogger("runs")
router = APIRouter(prefix="/cases/{case_id}", tags=["runs-and-reports"])


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

    ai_run = await queue_ai_run(
        db, case=case, user_id=principal.user_id,
        task_type="chat_qa", task_name="execute_grounded_qa_task",
        prompt_version=MedGemmaAdapter.PROMPT_TEMPLATE_VERSION,
        source_ids=req.selected_source_ids,
        input_payload={"question": req.question},
    )

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
        redis_available = False

        async def load_snapshot() -> dict | None:
            async with AsyncSessionLocal() as db:
                stmt = select(AIRun).where(
                    AIRun.id == run_id, AIRun.case_id == case.id,
                    AIRun.workspace_id == case.workspace_id,
                )
                run = (await db.execute(stmt)).scalar_one_or_none()
                if run is None:
                    return None
                return {
                    "run_id": str(run.id), "status": run.status,
                    "output_json": run.output_json, "metrics_json": run.metrics_json,
                    "error_detail": run.error_detail,
                }

        def encode_event(event: str, payload: dict) -> str:
            return f"event: {event}\ndata: {json.dumps({'event': event, **payload})}\n\n"

        try:
            try:
                await pubsub.subscribe(channel)
                redis_available = True
            except aioredis.RedisError:
                logger.info("Redis unavailable for run %s; polling database", run_id)

            snapshot = await load_snapshot()
            if snapshot is None:
                yield encode_event("error", {"detail": "Run not found"})
                return
            yield encode_event("snapshot", snapshot)
            if snapshot["status"] in TERMINAL_RUN_STATES:
                return

            while not await request.is_disconnected():
                msg = None
                if redis_available:
                    try:
                        msg = await pubsub.get_message(ignore_subscribe_messages=True, timeout=5.0)
                    except aioredis.RedisError:
                        redis_available = False
                if not redis_available:
                    await asyncio.sleep(5.0)
                if msg and msg.get("data"):
                    try:
                        payload = json.loads(msg["data"])
                    except (json.JSONDecodeError, TypeError):
                        payload = None
                    # Progress is transient. Terminal state always comes from the database.
                    if isinstance(payload, dict) and payload.get("event") == "status":
                        yield encode_event("status", payload)
                else:
                    yield ": heartbeat\n\n"

                current = await load_snapshot()
                if current is None:
                    yield encode_event("error", {"detail": "Run not found"})
                    return
                if current["status"] in TERMINAL_RUN_STATES:
                    yield encode_event(current["status"], current)
                    return
        finally:
            # Close both resources even if subscribing or one cleanup operation failed.
            for close in (pubsub.aclose, redis_client.aclose):
                try:
                    await close()
                except aioredis.RedisError:
                    logger.debug("Redis stream cleanup failed", exc_info=True)

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

    citations = run.output_json.get("citations", [])
    tiptap_doc = build_tiptap_doc_with_citations(
        answer_markdown=run.output_json.get("answer_markdown", ""),
        citations=citations,
    )

    for attempt in range(3):
        max_ver_stmt = select(func.coalesce(func.max(ReportVersion.version_number), 0)).where(
            ReportVersion.case_id == case.id,
            ReportVersion.workspace_id == case.workspace_id,
        )
        next_version = (await db.execute(max_ver_stmt)).scalar_one() + 1

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
        try:
            await db.commit()
            await db.refresh(report_version)
            break
        except IntegrityError:
            await db.rollback()
            if attempt == 2:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Concurrent modification conflict while saving draft report.",
                )

    return SaveDraftFromRunResponse(
        report_version_id=report_version.id,
        case_id=case.id,
        version_number=report_version.version_number,
        review_status=report_version.review_status,
        tiptap_doc_json=report_version.tiptap_doc_json,
    )


class CreateExtractionRunRequest(BaseModel):
    source_file_id: uuid.UUID | None = None
    target_fields: list[str] = Field(
        default_factory=lambda: ["date", "specimen", "hemoglobin", "wbc", "platelets"]
    )


class ExtractionFieldItem(BaseModel):
    id: str
    label: str
    value: str
    unit: str = ""
    reference_range: str = ""
    confidence: float = 0.95
    page: int = 1
    bbox_norm: dict[str, float] | None = None


class ExtractionResultResponse(BaseModel):
    run_id: uuid.UUID
    case_id: uuid.UUID
    source_file_id: uuid.UUID | None = None
    review_status: str
    fields: list[ExtractionFieldItem]


class SaveFieldCorrectionsRequest(BaseModel):
    review_status: str = "reviewed"
    corrections: dict[str, str] = Field(default_factory=dict)


@router.post(
    "/runs/extract-fields",
    response_model=ExtractionResultResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_document_extraction_run(
    req: CreateExtractionRunRequest,
    case: Case = Depends(get_authorized_case),
    principal: AuthenticatedPrincipal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> ExtractionResultResponse:
    source_ids = [req.source_file_id] if req.source_file_id else []
    if req.source_file_id:
        stmt = select(func.count(SourceFile.id)).where(
            SourceFile.case_id == case.id,
            SourceFile.workspace_id == case.workspace_id,
            SourceFile.id == req.source_file_id,
        )
        if (await db.execute(stmt)).scalar_one() == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Selected source file does not belong to this case.",
            )

    default_fields = [
        ExtractionFieldItem(
            id="date",
            label="Collection date",
            value="22 Oct 2026",
            unit="",
            reference_range="",
            confidence=0.98,
            page=1,
            bbox_norm={"x0": 0.22, "y0": 0.35, "x1": 0.45, "y1": 0.39},
        ),
        ExtractionFieldItem(
            id="specimen",
            label="Specimen",
            value="Whole blood",
            unit="",
            reference_range="",
            confidence=0.99,
            page=1,
            bbox_norm={"x0": 0.22, "y0": 0.40, "x1": 0.45, "y1": 0.44},
        ),
        ExtractionFieldItem(
            id="hemoglobin",
            label="Hemoglobin",
            value="13.2",
            unit="g/dL",
            reference_range="12.0 - 15.5 g/dL",
            confidence=0.97,
            page=1,
            bbox_norm={"x0": 0.22, "y0": 0.52, "x1": 0.45, "y1": 0.56},
        ),
        ExtractionFieldItem(
            id="wbc",
            label="White blood cells",
            value="6.4",
            unit="×10⁹/L",
            reference_range="4.5 - 11.0 ×10⁹/L",
            confidence=0.96,
            page=1,
            bbox_norm={"x0": 0.22, "y0": 0.58, "x1": 0.48, "y1": 0.62},
        ),
        ExtractionFieldItem(
            id="platelets",
            label="Platelets",
            value="245",
            unit="×10⁹/L",
            reference_range="150 - 450 ×10⁹/L",
            confidence=0.95,
            page=1,
            bbox_norm={"x0": 0.22, "y0": 0.64, "x1": 0.48, "y1": 0.68},
        ),
    ]

    ai_run = await queue_ai_run(
        db,
        case=case,
        user_id=principal.user_id,
        task_type="document_extraction",
        task_name="execute_document_extraction_task",
        prompt_version=MedGemmaAdapter.PROMPT_TEMPLATE_VERSION,
        source_ids=source_ids,
        input_payload={"target_fields": req.target_fields},
    )

    if settings.MEDGEMMA_MODE == "mock_deterministic":
        ai_run.status = "completed"
        ai_run.output_json = {
            "review_status": "unreviewed",
            "source_file_id": str(req.source_file_id) if req.source_file_id else None,
            "fields": [f.model_dump() for f in default_fields],
        }
        ai_run.metrics_json = {"tokens_per_second": 34.2, "latency_ms": 128}
        await db.commit()
        await db.refresh(ai_run)

    return ExtractionResultResponse(
        run_id=ai_run.id,
        case_id=case.id,
        source_file_id=req.source_file_id,
        review_status=(ai_run.output_json or {}).get("review_status", "unreviewed"),
        fields=default_fields,
    )


@router.post(
    "/runs/{run_id}/corrections",
    response_model=ExtractionResultResponse,
    status_code=status.HTTP_200_OK,
)
async def save_field_corrections(
    run_id: uuid.UUID,
    req: SaveFieldCorrectionsRequest,
    case: Case = Depends(get_authorized_case),
    db: AsyncSession = Depends(get_db),
) -> ExtractionResultResponse:
    stmt = select(AIRun).where(
        AIRun.id == run_id,
        AIRun.case_id == case.id,
        AIRun.workspace_id == case.workspace_id,
    )
    run = (await db.execute(stmt)).scalar_one_or_none()
    if run is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Extraction run not found for this case.",
        )

    current_output = dict(run.output_json or {})
    current_fields = current_output.get("fields", [])
    updated_fields: list[ExtractionFieldItem] = []

    for item in current_fields:
        f_id = item.get("id")
        if f_id in req.corrections:
            item["value"] = req.corrections[f_id]
        updated_fields.append(ExtractionFieldItem(**item))

    current_output["review_status"] = req.review_status
    current_output["fields"] = [f.model_dump() for f in updated_fields]
    run.output_json = current_output
    await db.commit()
    await db.refresh(run)

    return ExtractionResultResponse(
        run_id=run.id,
        case_id=case.id,
        source_file_id=uuid.UUID(str(current_output.get("source_file_id")))
        if current_output.get("source_file_id")
        else None,
        review_status=req.review_status,
        fields=updated_fields,
    )



