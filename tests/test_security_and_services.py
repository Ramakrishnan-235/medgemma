import os
import sys
import unittest
import uuid
from unittest.mock import AsyncMock, MagicMock

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "api")))

from fastapi import HTTPException
from app.core.security import _validate_claims
from app.services.medgemma_adapter import GroundedGenerationOutput, MedGemmaAdapter, VerifiedCitation


class TestSecurity(unittest.TestCase):
    def test_validate_claims_valid(self) -> None:
        payload = {"sub": str(uuid.uuid4()), "workspace_id": str(uuid.uuid4())}
        # Should not raise
        _validate_claims(payload)

    def test_validate_claims_missing_sub(self) -> None:
        payload = {"workspace_id": str(uuid.uuid4())}
        with self.assertRaises(HTTPException) as ctx:
            _validate_claims(payload)
        self.assertEqual(ctx.exception.status_code, 401)
        self.assertIn("sub", ctx.exception.detail)

    def test_validate_claims_missing_workspace(self) -> None:
        payload = {"sub": str(uuid.uuid4())}
        with self.assertRaises(HTTPException) as ctx:
            _validate_claims(payload)
        self.assertEqual(ctx.exception.status_code, 401)
        self.assertIn("workspace_id", ctx.exception.detail)


class TestMedGemmaAdapter(unittest.IsolatedAsyncioTestCase):
    def test_verified_citation_model(self) -> None:
        cit = VerifiedCitation(
            citation_id="cit_1",
            evidence_chunk_id=uuid.uuid4(),
            source_file_id=uuid.uuid4(),
            page_or_frame=1,
            verbatim_quote="RBC transports oxygen.",
        )
        self.assertEqual(cit.citation_id, "cit_1")
        self.assertEqual(cit.page_or_frame, 1)

    async def test_adapter_grounded_answer_citation_resolution(self) -> None:
        chunk_id = uuid.uuid4()
        source_id = uuid.uuid4()
        allowed_chunks = {
            "cit_1": {
                "id": str(chunk_id),
                "source_file_id": str(source_id),
                "page_or_frame": 2,
                "content_text": "Normal hemoglobin range is 13.8 to 17.2 g/dL.",
            }
        }

        mock_resp_data = {
            "generated_text": '{"answer_markdown": "Hemoglobin is normal [cit_1]. Unauthorized [cit_99].", "cited_keys": ["cit_1", "cit_99"]}',
            "model_checkpoint": "google/medgemma-1.5-4b-it",
            "processor_version": "1.5.0-896px",
            "execution_mode": "local_4bit",
            "queue_wait_ms": 12,
            "inference_ms": 340.5,
            "input_token_count": 85,
            "output_token_count": 42,
        }

        mock_response = MagicMock()
        mock_response.json.return_value = mock_resp_data
        mock_response.raise_for_status.return_value = None

        mock_client = MagicMock()
        mock_client.post = AsyncMock(return_value=mock_response)

        adapter = MedGemmaAdapter(client=mock_client)
        output = await adapter.generate_grounded_answer(
            question="What is the hemoglobin range?",
            allowed_chunks=allowed_chunks,
        )

        self.assertIsInstance(output, GroundedGenerationOutput)
        self.assertIn("[cit_1]", output.answer_markdown)
        # Verify that cit_99 was discarded because it is not in allowed_chunks
        self.assertEqual(len(output.citations), 1)
        self.assertEqual(output.citations[0].citation_id, "cit_1")
        self.assertEqual(output.citations[0].evidence_chunk_id, chunk_id)
        self.assertEqual(output.citations[0].source_file_id, source_id)
        self.assertEqual(output.telemetry["queue_wait_ms"], 12)
        self.assertEqual(output.telemetry["inference_ms"], 340.5)


if __name__ == "__main__":
    unittest.main()
