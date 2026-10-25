import os
import sys
import unittest
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "api")))

from fastapi import HTTPException
from app.api.v1.ehr import (
    CitationInspectionResponse,
    CreateEHRSummaryRunRequest,
    create_ehr_summary_run,
    get_citation_source_highlight,
)
from app.api.deps import AuthenticatedPrincipal
from app.db.models import Case, EvidenceChunk, SourceFile
from app.services.ehr_summarizer import (
    EHRSectionOutput,
    EHRSummaryPayload,
    ExtractedClinicalFact,
    TwoPassEHRSummarizer,
)
from app.services.pdf_ocr_pipeline import (
    ExtractedChunkSpec,
    HybridPdfOcrExtractor,
    boxes_overlap,
    detect_section_type,
    extract_encounter_date_iso,
    format_table_as_markdown,
)


class TestPdfOcrPipeline(unittest.TestCase):
    def test_extract_encounter_date_iso_formats(self) -> None:
        # Standard ISO
        self.assertEqual(
            extract_encounter_date_iso("Encounter Date: 2024-05-12 in Clinic A"),
            "2024-05-12",
        )
        # Slash format MM/DD/YYYY
        self.assertEqual(
            extract_encounter_date_iso("Date of Service: 10/24/2024 - Annual physical"),
            "2024-10-24",
        )
        # Hyphen format DD-MM-YYYY
        self.assertEqual(
            extract_encounter_date_iso("Admission Date: 15-08-2023 at 08:30"),
            "2023-08-15",
        )
        # Written month format
        self.assertEqual(
            extract_encounter_date_iso("DOS: 14 October 2024"),
            "2024-10-14",
        )
        # No date in clinical text
        self.assertIsNone(
            extract_encounter_date_iso("Patient presents with severe persistent cough.")
        )
        # Out of bounds date (e.g. year 1920 or 2099)
        self.assertIsNone(
            extract_encounter_date_iso("Encounter Date: 1940-01-01")
        )

    def test_detect_section_type(self) -> None:
        self.assertEqual(
            detect_section_type("ALLERGIES: No known drug allergies (NKDA)."),
            "allergies",
        )
        self.assertEqual(
            detect_section_type("CURRENT MEDICATIONS: Lisinopril 10mg daily PO."),
            "medications",
        )
        self.assertEqual(
            detect_section_type("ASSESSMENT & PROBLEM LIST:\n1. Type 2 Diabetes"),
            "problems",
        )
        self.assertEqual(
            detect_section_type("LABORATORY RESULTS:\nWBC 6.5, Hemoglobin 14.2"),
            "labs",
        )
        self.assertEqual(
            detect_section_type("CHEST X-RAY IMPRESSION: Clear bilateral lung fields."),
            "imaging",
        )
        self.assertEqual(
            detect_section_type("Patient was seen for routine follow up.", default="body"),
            "body",
        )

    def test_format_table_as_markdown(self) -> None:
        raw_table = [
            ["Medication", "Dose", "Frequency"],
            ["Metformin", "500 mg", "BID"],
            ["Atorvastatin", "20 mg", "QHS"],
        ]
        md = format_table_as_markdown(raw_table)
        self.assertIn("| Medication | Dose | Frequency |", md)
        self.assertIn("| Metformin | 500 mg | BID |", md)
        self.assertIn("| Atorvastatin | 20 mg | QHS |", md)

    def test_boxes_overlap(self) -> None:
        box1 = (10.0, 10.0, 50.0, 50.0)
        box2 = (30.0, 30.0, 70.0, 70.0)
        box3 = (60.0, 60.0, 100.0, 100.0)

        self.assertTrue(boxes_overlap(box1, box2))
        self.assertFalse(boxes_overlap(box1, box3))

    def test_hybrid_extractor_fallback_when_pdfium_missing(self) -> None:
        extractor = HybridPdfOcrExtractor()
        with patch("app.services.pdf_ocr_pipeline.pdfium", None):
            raw = b"Clinical encounter report\nDate of visit: 2024-07-20\nDiagnosis: Hypertension"
            res = extractor.parse_pdf_bytes(raw)
            self.assertEqual(res.page_count, 1)
            self.assertEqual(len(res.chunks), 1)
            self.assertEqual(res.encounter_date_iso, "2024-07-20")
            self.assertIn("Clinical encounter report", res.chunks[0].content_text)


class TestEHRSummarizer(unittest.IsolatedAsyncioTestCase):
    async def test_empty_evidence_produces_missing_information_state(self) -> None:
        summarizer = TwoPassEHRSummarizer()
        mock_db = AsyncMock()

        # Mock _retrieve_chronological_evidence returning empty chunks
        with patch.object(
            summarizer,
            "_retrieve_chronological_evidence",
            return_value=([], {}),
        ):
            payload = await summarizer.execute_two_pass_summary(
                db=mock_db,
                workspace_id=uuid.uuid4(),
                case_id=uuid.uuid4(),
            )
            self.assertIsInstance(payload, EHRSummaryPayload)
            self.assertEqual(len(payload.all_citations), 0)
            for section in payload.sections.values():
                self.assertTrue(section.missing_information)
                self.assertEqual(section.summary_markdown, "No documented evidence in selected sources.")

    async def test_deterministic_citation_gate_filters_hallucinated_keys(self) -> None:
        summarizer = TwoPassEHRSummarizer()
        mock_db = AsyncMock()

        allowed_chunks = {
            "cit_1": {
                "id": uuid.uuid4(),
                "source_file_id": uuid.uuid4(),
                "filename": "note1.pdf",
                "encounter_date": "2024-01-10",
                "page_or_frame": 1,
                "bbox_norm": {"x0": 0.1, "y0": 0.1, "x1": 0.9, "y1": 0.9},
                "section_type": "problems",
                "content_text": "Patient has confirmed mild asthma.",
            }
        }

        # MedGemma returns one valid fact (cit_1) and one hallucinated fact (cit_99)
        pass1_mock = {
            "facts": [
                {
                    "category": "problems",
                    "statement": "Mild asthma",
                    "status_or_severity": "mild",
                    "encounter_date": "2024-01-10",
                    "citation_id": "cit_1",
                },
                {
                    "category": "problems",
                    "statement": "Severe kidney failure",  # Hallucinated
                    "status_or_severity": "severe",
                    "citation_id": "cit_99",
                },
            ]
        }
        telemetry_mock = {
            "model_checkpoint": "medgemma-1.5",
            "processor_version": "v1",
            "execution_mode": "test",
            "queue_wait_ms": 1.2,
            "inference_ms": 45.6,
            "input_token_count": 100,
            "output_token_count": 50,
        }

        with (
            patch.object(
                summarizer,
                "_retrieve_chronological_evidence",
                return_value=([{"source_file_id": "s1"}], allowed_chunks),
            ),
            patch.object(
                summarizer,
                "_call_medgemma_json",
                side_effect=[
                    (pass1_mock, telemetry_mock),
                    ({"problems": "- **2024-01-10**: Mild asthma [cit_1]"}, telemetry_mock),
                ],
            ),
        ):
            payload = await summarizer.execute_two_pass_summary(
                db=mock_db,
                workspace_id=uuid.uuid4(),
                case_id=uuid.uuid4(),
            )
            problems_sec = payload.sections["problems"]
            self.assertFalse(problems_sec.missing_information)
            # Only cit_1 should survive
            self.assertEqual(len(problems_sec.verified_facts), 1)
            self.assertEqual(problems_sec.verified_facts[0].statement, "Mild asthma")
            self.assertEqual(len(problems_sec.citations), 1)
            self.assertEqual(problems_sec.citations[0].citation_id, "cit_1")


class TestEHRAPIEndpoints(unittest.IsolatedAsyncioTestCase):
    async def test_create_ehr_summary_tenant_isolation(self) -> None:
        case = Case(
            id=uuid.uuid4(),
            workspace_id=uuid.uuid4(),
            patient_code="PT-100",
            title="Cardiology Consult",
            created_by=uuid.uuid4(),
        )
        principal = AuthenticatedPrincipal(
            user_id=uuid.uuid4(),
            workspace_id=case.workspace_id,
        )

        foreign_source_id = uuid.uuid4()
        req = CreateEHRSummaryRunRequest(selected_source_ids=[foreign_source_id])

        mock_db = AsyncMock()
        # Mock scalar_one returning 0 matched rows (meaning foreign source doesn't belong to this case)
        mock_result = MagicMock()
        mock_result.scalar_one.return_value = 0
        mock_db.execute.return_value = mock_result

        with self.assertRaises(HTTPException) as ctx:
            await create_ehr_summary_run(
                req=req,
                case=case,
                principal=principal,
                db=mock_db,
            )
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("do not belong to this case", ctx.exception.detail)

    async def test_create_ehr_summary_run_success(self) -> None:
        case = Case(
            id=uuid.uuid4(),
            workspace_id=uuid.uuid4(),
            patient_code="PT-100",
            title="Cardiology Consult",
            created_by=uuid.uuid4(),
        )
        principal = AuthenticatedPrincipal(
            user_id=uuid.uuid4(),
            workspace_id=case.workspace_id,
        )
        source_id = uuid.uuid4()
        req = CreateEHRSummaryRunRequest(selected_source_ids=[source_id])

        mock_db = AsyncMock()
        mock_db.add = MagicMock()
        mock_result = MagicMock()
        mock_result.scalar_one.return_value = 1
        mock_db.execute.return_value = mock_result

        res = await create_ehr_summary_run(
            req=req,
            case=case,
            principal=principal,
            db=mock_db,
        )
        self.assertEqual(res["status"], "queued")
        self.assertEqual(res["task_type"], "ehr_summary")
        self.assertTrue(mock_db.add.called)
        self.assertTrue(mock_db.commit.called)

    async def test_get_citation_source_highlight(self) -> None:
        case = Case(
            id=uuid.uuid4(),
            workspace_id=uuid.uuid4(),
            patient_code="PT-100",
            title="Cardiology Consult",
            created_by=uuid.uuid4(),
        )
        chunk_id = uuid.uuid4()
        source_id = uuid.uuid4()
        chunk = EvidenceChunk(
            id=chunk_id,
            workspace_id=case.workspace_id,
            case_id=case.id,
            source_file_id=source_id,
            page_or_frame=2,
            bbox_norm={"x0": 0.1, "y0": 0.2, "x1": 0.8, "y1": 0.6},
            section_type="medications",
            content_text="Metformin 500mg daily",
            embedding=[0.0] * 384,
        )
        source = SourceFile(
            id=source_id,
            workspace_id=case.workspace_id,
            case_id=case.id,
            filename="discharge.pdf",
            file_kind="pdf",
            storage_key="cases/1/discharge.pdf",
            sha256_hash="0" * 64,
            mime_type="application/pdf",
            byte_size=1024,
            metadata_json={"encounter_date": "2024-03-01"},
        )

        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.first.return_value = (chunk, source)
        mock_db.execute.return_value = mock_result

        res = await get_citation_source_highlight(
            evidence_chunk_id=chunk_id,
            case=case,
            db=mock_db,
        )
        self.assertEqual(res.evidence_chunk_id, chunk_id)
        self.assertEqual(res.section_type, "medications")
        self.assertEqual(res.encounter_date, "2024-03-01")

    async def test_get_citation_source_highlight_not_found(self) -> None:
        case = Case(
            id=uuid.uuid4(),
            workspace_id=uuid.uuid4(),
            patient_code="PT-100",
            title="Cardiology Consult",
            created_by=uuid.uuid4(),
        )
        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.first.return_value = None
        mock_db.execute.return_value = mock_result

        with self.assertRaises(HTTPException) as ctx:
            await get_citation_source_highlight(
                evidence_chunk_id=uuid.uuid4(),
                case=case,
                db=mock_db,
            )
        self.assertEqual(ctx.exception.status_code, 404)

    async def test_citation_inspection_response_model(self) -> None:
        resp = CitationInspectionResponse(
            evidence_chunk_id=uuid.uuid4(),
            source_file_id=uuid.uuid4(),
            filename="consult_note.pdf",
            encounter_date="2024-06-01",
            page_or_frame=1,
            bbox_norm={"x0": 0.05, "y0": 0.05, "x1": 0.95, "y1": 0.45},
            section_type="allergies",
            verbatim_text="Penicillin causes anaphylaxis.",
            page_preview_url="https://s3.example.com/previews/1.png",
        )
        self.assertEqual(resp.section_type, "allergies")
        self.assertIn("Penicillin", resp.verbatim_text)
