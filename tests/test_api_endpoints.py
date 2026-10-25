import os
import sys
import unittest
import uuid

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "api")))

from pydantic import ValidationError
from app.api.v1.runs import CreateGroundedQARunRequest, build_tiptap_doc_with_citations
from app.api.v1.uploads import PresignUploadRequest
from app.services.embeddings import embed_passages_cpu, embed_query_cpu


class TestUploadsAPI(unittest.TestCase):
    def test_presign_request_valid(self) -> None:
        req = PresignUploadRequest(
            filename="chest_xray.png",
            file_kind="image_png",
            mime_type="image/png",
            byte_size=1024 * 500,
            sha256_hash="a" * 64,
        )
        self.assertEqual(req.filename, "chest_xray.png")
        self.assertEqual(req.file_kind, "image_png")

    def test_presign_request_oversized(self) -> None:
        with self.assertRaises(ValidationError):
            PresignUploadRequest(
                filename="huge_dataset.zip",
                file_kind="dicom",
                mime_type="application/octet-stream",
                byte_size=600_000_000,  # Exceeds 500MB limit
                sha256_hash="a" * 64,
            )

    def test_presign_request_invalid_hash(self) -> None:
        with self.assertRaises(ValidationError):
            PresignUploadRequest(
                filename="file.pdf",
                file_kind="pdf",
                mime_type="application/pdf",
                byte_size=1000,
                sha256_hash="short_hash",  # Not 64 chars
            )


class TestRunsAPI(unittest.TestCase):
    def test_create_qa_run_request(self) -> None:
        req = CreateGroundedQARunRequest(
            question="What are the findings on the left lung?",
            selected_source_ids=[uuid.uuid4()],
        )
        self.assertEqual(len(req.selected_source_ids), 1)

    def test_create_qa_run_request_too_short(self) -> None:
        with self.assertRaises(ValidationError):
            CreateGroundedQARunRequest(question="hi")

    def test_build_tiptap_doc_with_citations(self) -> None:
        citations = [
            {
                "citation_id": "cit_1",
                "evidence_chunk_id": str(uuid.uuid4()),
                "source_file_id": str(uuid.uuid4()),
                "page_or_frame": 1,
                "bbox_norm": {"x0": 0.1, "y0": 0.1, "x1": 0.9, "y1": 0.3},
                "verbatim_quote": "No pleural effusion.",
            }
        ]
        text = "Lungs are clear [cit_1]. No acute cardiopulmonary disease."
        doc = build_tiptap_doc_with_citations(text, citations)

        self.assertEqual(doc["type"], "doc")
        content = doc["content"][0]["content"]
        types = [item["type"] for item in content]
        self.assertIn("citationChip", types)
        self.assertIn("text", types)

        chip = next(item for item in content if item["type"] == "citationChip")
        self.assertEqual(chip["attrs"]["citationId"], "cit_1")
        self.assertEqual(chip["attrs"]["pageOrFrame"], 1)


class TestEmbeddings(unittest.TestCase):
    def test_embed_passages_cpu(self) -> None:
        passages = ["Patient exhibits normal sinus rhythm.", "Blood pressure is 120/80 mmHg."]
        vectors = embed_passages_cpu(passages)
        self.assertEqual(len(vectors), 2)
        self.assertEqual(len(vectors[0]), 384)
        self.assertEqual(len(vectors[1]), 384)

    def test_embed_query_cpu(self) -> None:
        vec = embed_query_cpu("What is the patient blood pressure?")
        self.assertEqual(len(vec), 384)


if __name__ == "__main__":
    unittest.main()
