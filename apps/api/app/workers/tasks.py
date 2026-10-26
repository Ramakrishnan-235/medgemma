import asyncio
import io
import json
import logging
import uuid
from datetime import datetime, timezone

import redis.asyncio as aioredis
from sqlalchemy import delete, select
from sqlalchemy.orm.exc import ObjectDeletedError

from app.core.config import settings
from app.core.storage import storage_adapter
from app.db.models import AIRun, EvidenceChunk, SourceFile
from app.db.session import AsyncSessionLocal
from app.services.ehr_summarizer import TwoPassEHRSummarizer
from app.services.embeddings import E5_MODEL_NAME, embed_passages_cpu, retrieve_case_evidence
from app.services.medgemma_adapter import MedGemmaAdapter
from app.services.pdf_ocr_pipeline import HybridPdfOcrExtractor, PARSER_VERSION
from app.services.xray_analyzer import ChestXrayAnalysisService
from app.workers.celery_app import celery_app

logger = logging.getLogger("celery_tasks")

celery_app.conf.task_routes.update({
    "app.workers.tasks.ingest_source_file_task": {"queue": "bulk"},
    "app.workers.tasks.execute_grounded_qa_task": {"queue": "interactive"},
    "app.workers.tasks.execute_ehr_summary_task": {"queue": "interactive"},
    "app.workers.tasks.execute_xray_analysis_task": {"queue": "interactive"},
    "app.workers.tasks.execute_longitudinal_xray_task": {"queue": "interactive"},
})



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


def _upload_page_previews_sync(
    bucket: str,
    workspace_id: uuid.UUID,
    case_id: uuid.UUID,
    source_id: uuid.UUID,
    page_previews: dict[int, bytes],
) -> dict[str, str]:
    """
    Synchronously uploads page preview PNGs in a worker thread to avoid
    blocking the async event loop.
    """
    preview_keys: dict[str, str] = {}
    for page_num, png_bytes in page_previews.items():
        preview_key = (
            f"workspaces/{workspace_id}/cases/{case_id}/previews/"
            f"{source_id}/page_{page_num}.png"
        )
        storage_adapter.internal_s3.put_object(
            Bucket=bucket,
            Key=preview_key,
            Body=png_bytes,
            ContentType="image/png",
        )
        preview_keys[str(page_num)] = preview_key
    return preview_keys


async def _ingest_source_file_async(
    workspace_id: uuid.UUID, case_id: uuid.UUID, source_file_id: uuid.UUID
) -> None:
    extractor = HybridPdfOcrExtractor()
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

            # Clear any prior chunks if re-parsing an existing source version
            await db.execute(
                delete(EvidenceChunk).where(EvidenceChunk.source_file_id == source.id)
            )

            if source.file_kind == "pdf":
                parsed_doc = await asyncio.to_thread(extractor.parse_pdf_bytes, raw_bytes)

                # Offload page preview PNG uploads to worker thread to avoid event loop stalls
                preview_keys = await asyncio.to_thread(
                    _upload_page_previews_sync,
                    storage_adapter.bucket,
                    workspace_id,
                    case_id,
                    source.id,
                    parsed_doc.page_previews_png,
                )

                chunk_specs = parsed_doc.chunks
                source.parser_version = parsed_doc.parser_version
                source.metadata_json = {
                    **(source.metadata_json or {}),
                    "page_count": parsed_doc.page_count,
                    "encounter_date": parsed_doc.encounter_date_iso,
                    "ocr_page_numbers": parsed_doc.ocr_page_numbers,
                    "page_preview_keys": preview_keys,
                }
            elif source.file_kind == "ehr_note":
                text = raw_bytes.decode("utf-8", errors="replace").strip()
                from app.services.pdf_ocr_pipeline import ExtractedChunkSpec
                chunk_specs = [
                    ExtractedChunkSpec(
                        page_or_frame=1,
                        bbox_norm={"x0": 0.0, "y0": 0.0, "x1": 1.0, "y1": 1.0},
                        section_type="clinical_note",
                        content_text=text[:2000],
                        extraction_method="native_text",
                    )
                ]
            elif source.file_kind in ("dicom", "image_png") or source.filename.lower().endswith((".dcm", ".png", ".jpg", ".jpeg")):
                from app.services.dicom_xray_pipeline import ChestXrayPreprocessor
                from app.services.pdf_ocr_pipeline import ExtractedChunkSpec

                preprocessor = ChestXrayPreprocessor()
                if source.file_kind == "dicom" or source.filename.lower().endswith(".dcm"):
                    normalized = await asyncio.to_thread(preprocessor.normalize_dicom_bytes, raw_bytes)
                else:
                    normalized = await asyncio.to_thread(preprocessor.normalize_standard_image_bytes, raw_bytes)

                display_key = f"workspaces/{workspace_id}/cases/{case_id}/imaging/{source.id}/display.png"
                medgemma_key = f"workspaces/{workspace_id}/cases/{case_id}/imaging/{source.id}/medgemma_896.png"

                await asyncio.to_thread(
                    storage_adapter.internal_s3.put_object,
                    Bucket=storage_adapter.bucket,
                    Key=display_key,
                    Body=normalized.display_png_bytes,
                    ContentType="image/png",
                )
                await asyncio.to_thread(
                    storage_adapter.internal_s3.put_object,
                    Bucket=storage_adapter.bucket,
                    Key=medgemma_key,
                    Body=normalized.medgemma_896_png_bytes,
                    ContentType="image/png",
                )

                view_pos = normalized.dicom_metadata.get("view_position", "UNKNOWN")
                enc_date = normalized.dicom_metadata.get("encounter_date") or "Undated"

                source.metadata_json = {
                    **(source.metadata_json or {}),
                    **normalized.dicom_metadata,
                    "display_png_key": display_key,
                    "medgemma_896_key": medgemma_key,
                    "encounter_date": normalized.dicom_metadata.get("encounter_date"),
                    "view_position": view_pos,
                }

                chunk_specs = [
                    ExtractedChunkSpec(
                        page_or_frame=1,
                        bbox_norm={"x0": 0.0, "y0": 0.0, "x1": 1.0, "y1": 1.0},
                        section_type="imaging_metadata",
                        content_text=f"Chest X-Ray ({view_pos}, {enc_date}): {source.filename}",
                        extraction_method="dicom_normalization",
                    )
                ]
            else:
                from app.services.pdf_ocr_pipeline import ExtractedChunkSpec
                chunk_specs = [
                    ExtractedChunkSpec(
                        page_or_frame=1,
                        bbox_norm={"x0": 0.0, "y0": 0.0, "x1": 1.0, "y1": 1.0},
                        section_type="imaging_metadata",
                        content_text=f"Imaging study file: {source.filename} ({source.file_kind})",
                        extraction_method="native_text",
                    )
                ]


            texts = [c.content_text for c in chunk_specs]
            embeddings = await asyncio.to_thread(embed_passages_cpu, texts)

            for spec, vector in zip(chunk_specs, embeddings):
                db.add(
                    EvidenceChunk(
                        workspace_id=workspace_id,
                        case_id=case_id,
                        source_file_id=source.id,
                        page_or_frame=spec.page_or_frame,
                        bbox_norm=spec.bbox_norm,
                        section_type=spec.section_type,
                        content_text=spec.content_text,
                        embedding=vector,
                        embedding_model=E5_MODEL_NAME,
                    )
                )

            source.parse_status = "ready"
            source.metadata_json = {
                **(source.metadata_json or {}),
                "chunk_count": len(chunk_specs),
            }
            await db.commit()
        except Exception as exc:
            source.parse_status = "failed"
            source.metadata_json = {**(source.metadata_json or {}), "error": str(exc)}
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
            try:
                run.status = "failed"
                run.error_detail = str(exc)
                run.completed_at = datetime.now(timezone.utc)
                await db.commit()
                await publish_run_event(
                    run.id,
                    "failed",
                    {"status": "failed", "error_detail": str(exc)},
                )
            except Exception as inner_exc:
                logger.warning("Could not persist failed state for QA run %s: %s", run_id, inner_exc)
            raise


async def _execute_ehr_summary_async(
    workspace_id: uuid.UUID, case_id: uuid.UUID, run_id: uuid.UUID
) -> None:
    summarizer = TwoPassEHRSummarizer()
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
        await publish_run_event(
            run.id,
            "status",
            {"status": "running", "stage": "pass1_extracting_chronological_facts"},
        )

        try:
            summary_payload = await summarizer.execute_two_pass_summary(
                db=db,
                workspace_id=workspace_id,
                case_id=case_id,
                selected_source_ids=run.input_source_ids or None,
            )

            try:
                await db.refresh(run)
                if run.status == "cancelled":
                    return
            except ObjectDeletedError:
                return

            output_dict = summary_payload.model_dump(mode="json")
            run.status = "completed"
            run.output_json = output_dict
            run.metrics_json = summary_payload.telemetry
            run.completed_at = datetime.now(timezone.utc)
            await db.commit()

            await publish_run_event(
                run.id,
                "completed",
                {
                    "status": "completed",
                    "output_json": output_dict,
                    "metrics_json": summary_payload.telemetry,
                },
            )
        except Exception as exc:
            try:
                run.status = "failed"
                run.error_detail = str(exc)
                run.completed_at = datetime.now(timezone.utc)
                await db.commit()
                await publish_run_event(
                    run.id, "failed", {"status": "failed", "error_detail": str(exc)}
                )
            except Exception as inner_exc:
                logger.warning("Could not persist failed state for EHR run %s: %s", run_id, inner_exc)
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


@celery_app.task(name="app.workers.tasks.execute_ehr_summary_task")
def execute_ehr_summary_task(workspace_id: str, case_id: str, run_id: str) -> None:
    asyncio.run(
        _execute_ehr_summary_async(
            uuid.UUID(workspace_id), uuid.UUID(case_id), uuid.UUID(run_id)
        )
    )


async def _execute_xray_analysis_async(
    workspace_id: uuid.UUID, case_id: uuid.UUID, run_id: uuid.UUID
) -> None:
    service = ChestXrayAnalysisService()
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
        await publish_run_event(
            run.id, "status", {"status": "running", "stage": "analyzing_chest_xray"}
        )

        try:
            source_id = uuid.UUID(run.input_payload_json["source_file_id"])
            indication = run.input_payload_json.get(
                "clinical_indication", "Routine chest radiograph evaluation."
            )
            result = await service.execute_single_xray_analysis(
                db=db,
                workspace_id=workspace_id,
                case_id=case_id,
                source_file_id=source_id,
                user_id=run.created_by,
                clinical_indication=indication,
                ai_run_id=run.id,
            )

            try:
                await db.refresh(run)
                if run.status == "cancelled":
                    return
            except ObjectDeletedError:
                return

            output_dict = result.model_dump(mode="json")
            run.status = "completed"
            run.output_json = output_dict
            run.metrics_json = result.telemetry
            run.completed_at = datetime.now(timezone.utc)
            await db.commit()

            await publish_run_event(
                run.id,
                "completed",
                {
                    "status": "completed",
                    "output_json": output_dict,
                    "metrics_json": result.telemetry,
                },
            )
        except Exception as exc:
            try:
                run.status = "failed"
                run.error_detail = str(exc)
                run.completed_at = datetime.now(timezone.utc)
                await db.commit()
                await publish_run_event(
                    run.id, "failed", {"status": "failed", "error_detail": str(exc)}
                )
            except Exception as inner_exc:
                logger.warning("Could not persist failed state for X-ray run %s: %s", run_id, inner_exc)
            raise


async def _execute_longitudinal_xray_async(
    workspace_id: uuid.UUID, case_id: uuid.UUID, run_id: uuid.UUID
) -> None:
    service = ChestXrayAnalysisService()
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
        await publish_run_event(
            run.id, "status", {"status": "running", "stage": "comparing_longitudinal_xrays"}
        )

        try:
            prior_id = uuid.UUID(run.input_payload_json["prior_source_file_id"])
            curr_id = uuid.UUID(run.input_payload_json["current_source_file_id"])
            question = run.input_payload_json.get(
                "clinical_question",
                "Evaluate interval change between prior and current chest radiographs.",
            )
            result = await service.execute_longitudinal_comparison(
                db=db,
                workspace_id=workspace_id,
                case_id=case_id,
                prior_source_file_id=prior_id,
                current_source_file_id=curr_id,
                clinical_question=question,
            )

            try:
                await db.refresh(run)
                if run.status == "cancelled":
                    return
            except ObjectDeletedError:
                return

            output_dict = result.model_dump(mode="json")
            run.status = "completed"
            run.output_json = output_dict
            run.metrics_json = result.telemetry
            run.completed_at = datetime.now(timezone.utc)
            await db.commit()

            await publish_run_event(
                run.id,
                "completed",
                {
                    "status": "completed",
                    "output_json": output_dict,
                    "metrics_json": result.telemetry,
                },
            )
        except Exception as exc:
            try:
                run.status = "failed"
                run.error_detail = str(exc)
                run.completed_at = datetime.now(timezone.utc)
                await db.commit()
                await publish_run_event(
                    run.id, "failed", {"status": "failed", "error_detail": str(exc)}
                )
            except Exception as inner_exc:
                logger.warning("Could not persist failed state for longitudinal X-ray run %s: %s", run_id, inner_exc)
            raise


@celery_app.task(name="app.workers.tasks.execute_xray_analysis_task")
def execute_xray_analysis_task(workspace_id: str, case_id: str, run_id: str) -> None:
    asyncio.run(
        _execute_xray_analysis_async(
            uuid.UUID(workspace_id), uuid.UUID(case_id), uuid.UUID(run_id)
        )
    )


@celery_app.task(name="app.workers.tasks.execute_longitudinal_xray_task")
def execute_longitudinal_xray_task(workspace_id: str, case_id: str, run_id: str) -> None:
    asyncio.run(
        _execute_longitudinal_xray_async(
            uuid.UUID(workspace_id), uuid.UUID(case_id), uuid.UUID(run_id)
        )
    )

