import io
import os
import sys
import unittest
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "api")))

from fastapi import HTTPException
from app.api.deps import AuthenticatedPrincipal
from app.api.v1.reports import (
    SaveReportVersionRequest,
    create_immutable_report_version,
    extract_citation_chips_from_tiptap,
    mark_report_version_reviewed,
    trigger_report_pdf_export,
)
from app.db.models import AIRun, Case, EvidenceChunk, JobOutbox, ReportVersion, SourceFile
from app.services.pdf_exporter import _tiptap_inline_to_reportlab_xml, render_clinical_report_pdf
from app.workers.recovery import cancel_active_run, recover_stalled_runs_and_files


class TestReportsAndRecovery(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        self.workspace_id = uuid.uuid4()
        self.case_id = uuid.uuid4()
        self.user_id = uuid.uuid4()
        self.case = Case(
            id=self.case_id,
            workspace_id=self.workspace_id,
            patient_code="PT-REPORT-001",
            title="Chest Imaging Followup",
            status="active",
            created_by=self.user_id,
        )
        self.principal = AuthenticatedPrincipal(
            user_id=self.user_id,
            workspace_id=self.workspace_id,
        )

    def test_extract_citation_chips_from_tiptap(self) -> None:
        sample_doc = {
            "type": "doc",
            "content": [
                {
                    "type": "paragraph",
                    "content": [
                        {"type": "text", "text": "Patient has clear lungs "},
                        {
                            "type": "citationChip",
                            "attrs": {
                                "citationId": "cit_1",
                                "evidenceChunkId": str(uuid.uuid4()),
                                "pageOrFrame": 1,
                            },
                        },
                        {"type": "text", "text": " and no effusion "},
                        {
                            "type": "citationChip",
                            "attrs": {
                                "citationId": "cit_2",
                                "evidenceChunkId": str(uuid.uuid4()),
                                "pageOrFrame": 2,
                            },
                        },
                    ],
                }
            ],
        }
        chips = extract_citation_chips_from_tiptap(sample_doc)
        self.assertEqual(len(chips), 2)
        self.assertEqual(chips[0]["citationId"], "cit_1")
        self.assertEqual(chips[1]["citationId"], "cit_2")

    def test_tiptap_inline_to_reportlab_xml_formatting(self) -> None:
        content_nodes = [
            {"type": "text", "text": "Clinical diagnosis: ", "marks": []},
            {"type": "text", "text": "Right lower lobe pneumonia", "marks": [{"type": "bold"}]},
            {
                "type": "citationChip",
                "attrs": {"citationId": "cit_1", "pageOrFrame": 3},
            },
        ]
        xml = _tiptap_inline_to_reportlab_xml(content_nodes)
        self.assertIn("<b>Right lower lobe pneumonia</b>", xml)
        self.assertIn("[cit_1 p.3]", xml)

    def test_render_clinical_report_pdf_generates_bytes(self) -> None:
        chunk_id = uuid.uuid4()
        source_id = uuid.uuid4()
        tiptap_doc = {
            "type": "doc",
            "content": [
                {
                    "type": "heading",
                    "attrs": {"level": 3},
                    "content": [{"type": "text", "text": "CHEST RADIOGRAPHY REPORT"}],
                },
                {
                    "type": "paragraph",
                    "content": [
                        {"type": "text", "text": "Lungs demonstrate no acute focal consolidation "},
                        {
                            "type": "citationChip",
                            "attrs": {
                                "citationId": "cit_1",
                                "evidenceChunkId": str(chunk_id),
                                "sourceFileId": str(source_id),
                                "pageOrFrame": 1,
                            },
                        },
                        {"type": "text", "text": "."},
                    ],
                },
                {
                    "type": "bulletList",
                    "content": [
                        {
                            "type": "listItem",
                            "content": [
                                {
                                    "type": "paragraph",
                                    "content": [{"type": "text", "text": "No pneumothorax"}],
                                }
                            ],
                        }
                    ],
                },
            ],
        }
        citations_snapshot = [
            {
                "citation_id": "cit_1",
                "evidence_chunk_id": str(chunk_id),
                "source_file_id": str(source_id),
                "page_or_frame": 1,
                "bbox_norm": {"x0": 0.1, "y0": 0.2, "x1": 0.8, "y1": 0.5},
                "verbatim_quote": "Lungs are well expanded with clear costophrenic angles.",
            }
        ]
        source_files_map = {
            str(source_id): {
                "filename": "chest_xray_pa.dcm",
                "sha256_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            }
        }
        run_meta = {
            "model_checkpoint": "google/medgemma-1.5-4b-it",
            "processor_version": "1.5.0-896px",
            "prompt_template_version": "v1.0-cxr-structured-single",
        }

        pdf_bytes = render_clinical_report_pdf(
            case_title="Followup Case 024",
            patient_code="PT-REPORT-001",
            version_number=1,
            reviewed_by_str="Dr. Radiologist (MD)",
            tiptap_doc=tiptap_doc,
            citations_snapshot=citations_snapshot,
            source_files_map=source_files_map,
            run_metadata=run_meta,
        )

        self.assertIsInstance(pdf_bytes, bytes)
        self.assertTrue(len(pdf_bytes) > 1000)
        self.assertTrue(pdf_bytes.startswith(b"%PDF-"))

    async def test_create_immutable_report_version_rejects_malformed_uuid(self) -> None:
        req = SaveReportVersionRequest(
            tiptap_doc_json={
                "type": "doc",
                "content": [
                    {
                        "type": "paragraph",
                        "content": [
                            {
                                "type": "citationChip",
                                "attrs": {
                                    "citationId": "cit_bad",
                                    "evidenceChunkId": "not-a-valid-uuid",
                                },
                            }
                        ],
                    }
                ],
            }
        )
        mock_db = MagicMock()
        with self.assertRaises(HTTPException) as ctx:
            await create_immutable_report_version(
                req=req,
                case=self.case,
                principal=self.principal,
                db=mock_db,
            )
        self.assertEqual(ctx.exception.status_code, 422)
        self.assertIn("Invalid evidenceChunkId UUID format", ctx.exception.detail)

    async def test_trigger_report_pdf_export_requires_reviewed_status(self) -> None:
        unreviewed_ver = ReportVersion(
            id=uuid.uuid4(),
            workspace_id=self.workspace_id,
            case_id=self.case_id,
            version_number=1,
            review_status="draft",  # Draft cannot be exported directly
            created_by=self.user_id,
            tiptap_doc_json={"type": "doc", "content": []},
            citations_snapshot_json=[],
        )
        mock_db = MagicMock()
        mock_scalar = MagicMock()
        mock_scalar.scalar_one_or_none.return_value = unreviewed_ver
        mock_db.execute = AsyncMock(return_value=mock_scalar)

        with self.assertRaises(HTTPException) as ctx:
            await trigger_report_pdf_export(
                version_number=1,
                case=self.case,
                db=mock_db,
            )
        self.assertEqual(ctx.exception.status_code, 409)
        self.assertIn("reviewed", ctx.exception.detail)


if __name__ == "__main__":
    unittest.main()
