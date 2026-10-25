import asyncio
import io
import json
import logging
import uuid
from datetime import datetime, timezone

try:
    import pypdfium2 as pdfium
except ImportError:
    pdfium = None  # type: ignore

import redis.asyncio as aioredis
from sqlalchemy import select
from sqlalchemy.orm.exc import ObjectDeletedError

from app.core.config import settings
from app.core.storage import storage_adapter
from app.db.models import AIRun, EvidenceChunk, SourceFile
from app.db.session import AsyncSessionLocal
from app.services.embeddings import E5_MODEL_NAME, embed_passages_cpu, retrieve_case_evidence
from app.services.medgemma_adapter import MedGemmaAdapter
from app.workers.celery_app import celery_app

logger = logging.getLogger("celery_tasks")

celery_app.conf.task_routes = {
    "app.workers.tasks.ingest_source_file_task": {"queue": "bulk"},
    "app.workers.tasks.execute_grounded_qa_task": {"queue": "interactive"},
}


async def publish_run_event(run_id: uuid.UUID, event_type: str, payload: dict) -> None:
    """
    Publishes transient real-time progress over Redis Pub/Sub.
    PostgreSQL is always updated BEFORE calling this function.
    """
    try:
        r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        message = json.dumps({"event": event_type, "run_id": str(run_id), **payload})
        await r.publish(f"run_events:{run_id}", message)
        await r.aclose()
    except Exception as exc:
        logger.debug("Redis notification skipped: %s", exc)


def extract_pdf_chunks_with_coords(raw_bytes: bytes) -> list[dict]:
    """
    Extracts text and normalized bounding-box coordinates from PDF bytes using pypdfium2.
    """
    if pdfium is None:
        return [
            {
                "page_or_frame": 1,
                "bbox_norm": {"x0": 0.05, "y0": 0.0, "x1": 0.95, "y1": 1.0},
                "section_type": "body",
                "content_text": raw_bytes.decode("utf-8", errors="replace")[:1500],
            }
        ]

    extracted: list[dict] = []
    try:
        doc = pdfium.PdfDocument(io.BytesIO(raw_bytes))
        try:
            for page_idx in range(len(doc)):
                page = doc[page_idx]
                try:
                    textpage = page.get_textpage()
                    try:
                        full_text = textpage.get_text_range().strip()
                        if not full_text:
                            continue

                        paragraphs = [p.strip() for p in full_text.split("\n\n") if len(p.strip()) > 20]
                        if not paragraphs:
                            paragraphs = [full_text]

                        for idx, para in enumerate(paragraphs):
                            y0 = round(idx / max(len(paragraphs), 1), 4)
                            y1 = round(min((idx + 1) / max(len(paragraphs), 1), 1.0), 4)
                            extracted.append(
                                {
                                    "page_or_frame": page_idx + 1,
                                    "bbox_norm": {"x0": 0.05, "y0": y0, "x1": 0.95, "y1": y1},
                                    "section_type": "body",
                                    "content_text": para[:1500],
                                }
                            )
                    finally:
                        textpage.close()
                finally:
                    page.close()
        finally:
            doc.close()
    except Exception as exc:
        logger.warning("pypdfium2 parser error: %s; falling back to raw decode", exc)
        if not extracted:
            extracted.append(
                {
                    "page_or_frame": 1,
                    "bbox_norm": {"x0": 0.05, "y0": 0.0, "x1": 0.95, "y1": 1.0},
                    "section_type": "body",
                    "content_text": raw_bytes.decode("utf-8", errors="replace")[:1500],
                }
            )

    return extracted


async def _ingest_source_file_async(
    workspace_id: uuid.UUID, case_id: uuid.UUID, source_file_id: uuid.UUID
) -> None:
    async with AsyncSessionLocal() as db:
        stmt = select(SourceFile).where(
            SourceFile.id == source_file_id,
            SourceFile.case_id == case_id,
            SourceFile.workspace_id == workspace_id,
        )
        source = (await db.execute(stmt)).scalar_one_or_none()
        if source is None:
            return

        source.parse_status = "processing"
        await db.commit()

        try:
            raw_bytes = await asyncio.to_thread(storage_adapter.get_object_bytes, source.storage_key)
            if source.file_kind == "pdf":
                raw_chunks = await asyncio.to_thread(extract_pdf_chunks_with_coords, raw_bytes)
            elif source.file_kind == "ehr_note":
                text = raw_bytes.decode("utf-8", errors="replace").strip()
                raw_chunks = [
                    {
                        "page_or_frame": 1,
                        "bbox_norm": {"x0": 0.0, "y0": 0.0, "x1": 1.0, "y1": 1.0},
                        "section_type": "clinical_note",
                        "content_text": text[:2000],
                    }
                ]
            else:
                raw_chunks = [
                    {
                        "page_or_frame": 1,
                        "bbox_norm": {"x0": 0.0, "y0": 0.0, "x1": 1.0, "y1": 1.0},
                        "section_type": "imaging_metadata",
                        "content_text": f"Imaging study file: {source.filename} ({source.file_kind})",
                    }
                ]

            texts = [c["content_text"] for c in raw_chunks]
            embeddings = await asyncio.to_thread(embed_passages_cpu, texts)

            for chunk_meta, vector in zip(raw_chunks, embeddings):
                db.add(
                    EvidenceChunk(
                        workspace_id=workspace_id,
                        case_id=case_id,
                        source_file_id=source.id,
                        page_or_frame=chunk_meta["page_or_frame"],
                        bbox_norm=chunk_meta["bbox_norm"],
                        section_type=chunk_meta["section_type"],
                        content_text=chunk_meta["content_text"],
                        embedding=vector,
                        embedding_model=E5_MODEL_NAME,
                    )
                )

            source.parse_status = "ready"
            source.metadata_json = {
                **source.metadata_json,
                "chunk_count": len(raw_chunks),
            }
            await db.commit()
        except Exception as exc:
            source.parse_status = "failed"
            source.metadata_json = {**source.metadata_json, "error": str(exc)}
            await db.commit()
            raise


async def _execute_grounded_qa_async(
    workspace_id: uuid.UUID, case_id: uuid.UUID, run_id: uuid.UUID
) -> None:
    adapter = MedGemmaAdapter()
    async with AsyncSessionLocal() as db:
        stmt = select(AIRun).where(
            AIRun.id == run_id,
            AIRun.case_id == case_id,
            AIRun.workspace_id == workspace_id,
        )
        run = (await db.execute(stmt)).scalar_one_or_none()
        if run is None or run.status == "cancelled":
            return

        run.status = "running"
        await db.commit()
        await publish_run_event(run.id, "status", {"status": "running", "stage": "retrieving"})

        try:
            question = run.input_payload_json.get("question", "")
            allowed_chunks = await retrieve_case_evidence(
                db=db,
                workspace_id=workspace_id,
                case_id=case_id,
                query_text=question,
                selected_source_ids=run.input_source_ids or None,
                top_k=8,
            )

            await publish_run_event(
                run.id,
                "status",
                {"status": "running", "stage": "generating", "retrieved_count": len(allowed_chunks)},
            )

            result = await adapter.generate_grounded_answer(
                question=question,
                allowed_chunks=allowed_chunks,
                images_b64=[],
            )

            # Re-check cancellation before committing output
            try:
                await db.refresh(run)
                if run.status == "cancelled":
                    return
            except ObjectDeletedError:
                return

            output_payload = {
                "answer_markdown": result.answer_markdown,
                "citations": [c.model_dump(mode="json") for c in result.citations],
                "limitations_note": result.limitations_note,
            }
            run.status = "completed"
            run.output_json = output_payload
            run.metrics_json = result.telemetry
            run.completed_at = datetime.now(timezone.utc)
            await db.commit()

            await publish_run_event(
                run.id,
                "completed",
                {
                    "status": "completed",
                    "output_json": output_payload,
                    "metrics_json": result.telemetry,
                },
            )
        except Exception as exc:
            run.status = "failed"
            run.error_detail = str(exc)
            run.completed_at = datetime.now(timezone.utc)
            await db.commit()
            await publish_run_event(
                run.id,
                "failed",
                {"status": "failed", "error_detail": str(exc)},
            )
            raise


@celery_app.task(name="app.workers.tasks.ingest_source_file_task")
def ingest_source_file_task(workspace_id: str, case_id: str, source_file_id: str) -> None:
    asyncio.run(
        _ingest_source_file_async(
            uuid.UUID(workspace_id), uuid.UUID(case_id), uuid.UUID(source_file_id)
        )
    )


@celery_app.task(name="app.workers.tasks.execute_grounded_qa_task")
def execute_grounded_qa_task(workspace_id: str, case_id: str, run_id: str) -> None:
    asyncio.run(
        _execute_grounded_qa_async(
            uuid.UUID(workspace_id), uuid.UUID(case_id), uuid.UUID(run_id)
        )
    )
