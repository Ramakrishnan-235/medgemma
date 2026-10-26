import base64
import json
import os
import sys
import unittest
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import httpx

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "api")))

from app.db.models import EvidenceChunk, ImageAnnotation, SourceFile
from app.services.dicom_xray_pipeline import compute_letterbox_transform
from app.services.xray_analyzer import (
    ChestXrayAnalysisService,
    LongitudinalIntervalChange,
    LongitudinalXrayPayload,
    SingleXrayAnalysisPayload,
    XrayObservationSection,
)


class TestXrayAnalyzerService(unittest.IsolatedAsyncioTestCase):
    async def test_single_xray_analysis_with_model_boxes(self) -> None:
        workspace_id = uuid.uuid4()
        case_id = uuid.uuid4()
        source_id = uuid.uuid4()
        user_id = uuid.uuid4()
        chunk_id = uuid.uuid4()

        tf = compute_letterbox_transform(1000, 1000, target_size=896)
        source = SourceFile(
            id=source_id,
            workspace_id=workspace_id,
            case_id=case_id,
            filename="cxr_pa.png",
            file_kind="image_png",
            storage_key="test/key",
            sha256_hash="a" * 64,
            mime_type="image/png",
            byte_size=1024,
            metadata_json={
                "medgemma_896_key": "test/key_896.png",
                "letterbox_transform": {
                    "orig_width": 1000,
                    "orig_height": 1000,
                    "target_size": 896,
                    "scale": 0.896,
                    "pad_left": 0,
                    "pad_top": 0,
                    "resized_width": 896,
                    "resized_height": 896,
                },
                "view_position": "PA",
                "encounter_date": "2024-04-10",
            },
        )
        chunk = EvidenceChunk(
            id=chunk_id,
            workspace_id=workspace_id,
            case_id=case_id,
            source_file_id=source_id,
            content_text="CXR PA",
            embedding=[0.0] * 384,
        )

        mock_db = AsyncMock()
        mock_db.add = MagicMock()
        mock_scalar_result = MagicMock()
        mock_scalar_result.scalar_one_or_none.return_value = source
        mock_scalar_result.scalars.return_value.first.return_value = chunk
        mock_db.execute.return_value = mock_scalar_result


        model_response = {
            "findings_by_region": [
                {
                    "anatomical_region": "lungs_airways",
                    "observation": "Right lower lobe consolidation consistent with pneumonia [cit_img_1].",
                    "abnormality_present": True,
                    "box_2d_1000": [400, 500, 700, 800],
                },
                {
                    "anatomical_region": "cardiomediastinal",
                    "observation": "Cardiothoracic ratio within normal limits.",
                    "abnormality_present": False,
                    "box_2d_1000": None,
                },
            ],
            "impression_markdown": "Right lower lobe pneumonia [cit_img_1].",
        }

        mock_resp = MagicMock()
        mock_resp.json.return_value = {
            "generated_text": json.dumps(model_response),
            "model_checkpoint": "google/medgemma-1.5-4b-it",
            "processor_version": "1.5.0",
            "queue_wait_ms": 12.5,
            "inference_ms": 320.0,
            "input_token_count": 280,
            "output_token_count": 95,
        }
        mock_resp.raise_for_status = MagicMock()

        mock_client = AsyncMock()
        mock_client.post.return_value = mock_resp

        service = ChestXrayAnalysisService(client=mock_client)
        with patch.object(service, "_load_medgemma_896_b64", return_value="base64pngdata"):
            with patch("app.services.xray_analyzer.FEATURE_MODEL_LOCALIZATION_BOXES", True):
                payload = await service.execute_single_xray_analysis(
                    db=mock_db,
                    workspace_id=workspace_id,
                    case_id=case_id,
                    source_file_id=source_id,
                    user_id=user_id,
                )

        self.assertEqual(payload.source_file_id, source_id)
        self.assertEqual(payload.view_position, "PA")
        self.assertEqual(len(payload.findings_by_region), 2)
        self.assertEqual(len(payload.citations), 1)
        self.assertEqual(payload.citations[0].citation_id, "cit_img_1")
        # Model boxes enabled => annotation added to db
        self.assertTrue(payload.model_boxes_enabled)
        self.assertEqual(len(payload.saved_annotation_ids), 1)
        self.assertTrue(mock_db.add.called)
        ann_added = mock_db.add.call_args[0][0]
        self.assertEqual(ann_added.id, payload.saved_annotation_ids[0])
        self.assertEqual(ann_added.origin, "model_medgemma")

    async def test_longitudinal_comparison_with_projection_warning(self) -> None:
        workspace_id = uuid.uuid4()
        case_id = uuid.uuid4()
        prior_id = uuid.uuid4()
        curr_id = uuid.uuid4()
        prior_chunk_id = uuid.uuid4()
        curr_chunk_id = uuid.uuid4()

        prior_src = SourceFile(
            id=prior_id,
            workspace_id=workspace_id,
            case_id=case_id,
            filename="cxr_prior_ap.png",
            file_kind="image_png",
            storage_key="test/prior",
            sha256_hash="a" * 64,
            mime_type="image/png",
            byte_size=1000,
            metadata_json={"view_position": "AP", "encounter_date": "2024-01-10"},
        )
        curr_src = SourceFile(
            id=curr_id,
            workspace_id=workspace_id,
            case_id=case_id,
            filename="cxr_curr_pa.png",
            file_kind="image_png",
            storage_key="test/curr",
            sha256_hash="b" * 64,
            mime_type="image/png",
            byte_size=1000,
            metadata_json={"view_position": "PA", "encounter_date": "2024-04-10"},
        )

        prior_chunk = EvidenceChunk(
            id=prior_chunk_id,
            workspace_id=workspace_id,
            case_id=case_id,
            source_file_id=prior_id,
            content_text="Prior CXR",
            embedding=[0.0] * 384,
        )
        curr_chunk = EvidenceChunk(
            id=curr_chunk_id,
            workspace_id=workspace_id,
            case_id=case_id,
            source_file_id=curr_id,
            content_text="Current CXR",
            embedding=[0.0] * 384,
        )

        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [prior_src, curr_src]
        mock_result.scalars.return_value.first.side_effect = [prior_chunk, curr_chunk]
        mock_db.execute.return_value = mock_result

        model_response = {
            "interval_changes": [
                {
                    "anatomical_region": "lungs_airways",
                    "change_status": "improved",
                    "description": "Right lower lobe airspace opacity has significantly resolved compared to prior exam.",
                    "citations": ["cit_prior", "cit_current"],
                }
            ],
            "comparison_summary_markdown": "Interval improvement in right basilar pneumonia [cit_prior] [cit_current].",
        }

        mock_resp = MagicMock()
        mock_resp.json.return_value = {
            "generated_text": json.dumps(model_response),
            "model_checkpoint": "google/medgemma-1.5-4b-it",
            "processor_version": "1.5.0",
            "queue_wait_ms": 10.0,
            "inference_ms": 450.0,
            "input_token_count": 550,
            "output_token_count": 120,
        }
        mock_resp.raise_for_status = MagicMock()

        mock_client = AsyncMock()
        mock_client.post.return_value = mock_resp

        service = ChestXrayAnalysisService(client=mock_client)
        with patch.object(service, "_load_medgemma_896_b64", return_value="base64pngdata"):
            payload = await service.execute_longitudinal_comparison(
                db=mock_db,
                workspace_id=workspace_id,
                case_id=case_id,
                prior_source_file_id=prior_id,
                current_source_file_id=curr_id,
            )

        self.assertEqual(payload.prior_source_file_id, prior_id)
        self.assertEqual(payload.current_source_file_id, curr_id)
        # Verify projection mismatch was caught
        self.assertIsNotNone(payload.projection_warning)
        assert payload.projection_warning is not None
        self.assertIn("AP whereas Current is PA", payload.projection_warning)
        self.assertEqual(len(payload.interval_changes), 1)
        self.assertEqual(payload.interval_changes[0].change_status, "improved")
        self.assertEqual(len(payload.citations), 2)
        citation_ids = [c.citation_id for c in payload.citations]
        self.assertIn("cit_prior", citation_ids)
        self.assertIn("cit_current", citation_ids)


if __name__ == "__main__":
    unittest.main()
