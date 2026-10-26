import os
import sys
import unittest
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi import HTTPException
from pydantic import ValidationError

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "api")))

from app.api.deps import AuthenticatedPrincipal
from app.api.v1.imaging import (
    CreateManualAnnotationRequest,
    TriggerLongitudinalXrayRequest,
    TriggerSingleXrayRequest,
    UpdateAnnotationReviewRequest,
    create_manual_annotation,
    get_xray_viewer_manifest,
    review_or_update_annotation,
    trigger_longitudinal_xray_run,
    trigger_single_xray_run,
)
from app.db.models import AIRun, Case, ImageAnnotation, JobOutbox, SourceFile


class TestImagingAPI(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        self.workspace_id = uuid.uuid4()
        self.case_id = uuid.uuid4()
        self.user_id = uuid.uuid4()
        self.case = Case(
            id=self.case_id,
            workspace_id=self.workspace_id,
            patient_code="PT-1001",
            title="Chest Evaluation",
            status="active",
            created_by=self.user_id,
        )
        self.principal = AuthenticatedPrincipal(
            user_id=self.user_id,
            workspace_id=self.workspace_id,
        )


    async def test_get_viewer_manifest_found(self) -> None:
        source_id = uuid.uuid4()
        source = SourceFile(
            id=source_id,
            workspace_id=self.workspace_id,
            case_id=self.case_id,
            filename="chest.dcm",
            file_kind="dicom",
            storage_key="raw/key.dcm",
            sha256_hash="c" * 64,
            mime_type="application/dicom",
            byte_size=2048,
            metadata_json={"display_png_key": "display/key.png", "view_position": "PA"},
        )
        ann = ImageAnnotation(
            id=uuid.uuid4(),
            workspace_id=self.workspace_id,
            case_id=self.case_id,
            source_file_id=source_id,
            origin="manual",
            anatomical_label="Right Infiltrate",
            finding_text="Consolidation noted",
            bbox_norm={"x0": 0.2, "y0": 0.3, "x1": 0.5, "y1": 0.6},
            review_state="accepted",
            created_by=self.user_id,
        )

        mock_db = AsyncMock()
        mock_source_res = MagicMock()
        mock_source_res.scalar_one_or_none.return_value = source

        mock_ann_res = MagicMock()
        mock_ann_res.scalars.return_value.all.return_value = [ann]

        mock_db.execute.side_effect = [mock_source_res, mock_ann_res]

        with patch("app.core.storage.storage_adapter.create_presigned_get_url", return_value="https://presigned.url"):
            manifest = await get_xray_viewer_manifest(
                source_file_id=source_id,
                case=self.case,
                db=mock_db,
            )

        self.assertEqual(manifest["source_file_id"], str(source_id))
        self.assertEqual(manifest["filename"], "chest.dcm")
        self.assertEqual(manifest["raw_dicom_or_image_url"], "https://presigned.url")
        self.assertEqual(manifest["normalized_display_png_url"], "https://presigned.url")
        self.assertEqual(len(manifest["annotations"]), 1)
        self.assertEqual(manifest["annotations"][0]["anatomical_label"], "Right Infiltrate")

    async def test_get_viewer_manifest_not_found(self) -> None:
        mock_db = AsyncMock()
        mock_res = MagicMock()
        mock_res.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_res

        with self.assertRaises(HTTPException) as ctx:
            await get_xray_viewer_manifest(
                source_file_id=uuid.uuid4(),
                case=self.case,
                db=mock_db,
            )
        self.assertEqual(ctx.exception.status_code, 404)

    async def test_create_manual_annotation(self) -> None:
        source_id = uuid.uuid4()
        source = SourceFile(
            id=source_id,
            workspace_id=self.workspace_id,
            case_id=self.case_id,
            filename="chest.png",
            file_kind="image_png",
            storage_key="test/key",
            sha256_hash="d" * 64,
            mime_type="image/png",
            byte_size=1024,
        )

        mock_db = AsyncMock()
        mock_db.add = MagicMock()
        mock_source_res = MagicMock()
        mock_source_res.scalar_one_or_none.return_value = source
        mock_db.execute.return_value = mock_source_res

        req = CreateManualAnnotationRequest(
            source_file_id=source_id,
            anatomical_label="Pleural Thickening",
            finding_text="Blunting of costophrenic angle",
            bbox_norm={"x0": 0.1, "y0": 0.2, "x1": 0.4, "y1": 0.5},
        )

        res = await create_manual_annotation(
            req=req,
            case=self.case,
            principal=self.principal,
            db=mock_db,
        )

        self.assertEqual(res["anatomical_label"], "Pleural Thickening")
        self.assertEqual(res["origin"], "manual")
        self.assertEqual(res["review_state"], "accepted")
        self.assertTrue(mock_db.add.called)
        self.assertTrue(mock_db.commit.called)

    def test_create_manual_annotation_invalid_bounds(self) -> None:
        source_id = uuid.uuid4()
        with self.assertRaises(ValidationError):
            CreateManualAnnotationRequest(
                source_file_id=source_id,
                anatomical_label="Infiltrate",
                bbox_norm={"x0": 0.5, "y0": 0.5, "x1": 0.2, "y1": 0.2},
            )

        with self.assertRaises(ValidationError):
            CreateManualAnnotationRequest(
                source_file_id=source_id,
                anatomical_label="A",  # Less than 2 chars
                bbox_norm={"x0": 0.1, "y0": 0.1, "x1": 0.5, "y1": 0.5},
            )

    async def test_update_annotation_review(self) -> None:
        ann_id = uuid.uuid4()
        ann = ImageAnnotation(
            id=ann_id,
            workspace_id=self.workspace_id,
            case_id=self.case_id,
            source_file_id=uuid.uuid4(),
            origin="model_medgemma",
            anatomical_label="Possible Mass",
            finding_text="Focal nodule",
            bbox_norm={"x0": 0.3, "y0": 0.3, "x1": 0.4, "y1": 0.4},
            review_state="pending_review",
            created_by=self.user_id,
        )

        mock_db = AsyncMock()
        mock_res = MagicMock()
        mock_res.scalar_one_or_none.return_value = ann
        mock_db.execute.return_value = mock_res

        req = UpdateAnnotationReviewRequest(
            review_state="accepted",
            finding_text="Verified solitary pulmonary nodule",
        )

        res = await review_or_update_annotation(
            annotation_id=ann_id,
            req=req,
            case=self.case,
            db=mock_db,
        )

        self.assertEqual(res["id"], str(ann_id))
        self.assertEqual(res["review_state"], "accepted")
        self.assertEqual(ann.finding_text, "Verified solitary pulmonary nodule")
        self.assertTrue(mock_db.commit.called)

    async def test_trigger_single_xray_run(self) -> None:
        source_id = uuid.uuid4()
        source = SourceFile(
            id=source_id,
            workspace_id=self.workspace_id,
            case_id=self.case_id,
            filename="film.png",
            file_kind="image_png",
            storage_key="test/film",
            sha256_hash="e" * 64,
            mime_type="image/png",
            byte_size=1024,
        )

        mock_db = AsyncMock()
        mock_db.add = MagicMock()
        mock_res = MagicMock()
        mock_res.scalar_one_or_none.return_value = source
        mock_db.execute.return_value = mock_res

        req = TriggerSingleXrayRequest(
            source_file_id=source_id,
            clinical_indication="Evaluate for pneumothorax",
        )

        res = await trigger_single_xray_run(
            req=req,
            case=self.case,
            principal=self.principal,
            db=mock_db,
        )

        self.assertEqual(res["status"], "queued")
        self.assertEqual(res["task_type"], "xray_analysis")
        self.assertIn("run_id", res)
        # Verify db.add was called for AIRun and JobOutbox
        self.assertEqual(mock_db.add.call_count, 2)
        self.assertTrue(mock_db.commit.called)

    async def test_trigger_longitudinal_xray_run(self) -> None:
        prior_id = uuid.uuid4()
        curr_id = uuid.uuid4()
        prior_src = SourceFile(
            id=prior_id,
            workspace_id=self.workspace_id,
            case_id=self.case_id,
            filename="prior.png",
            file_kind="image_png",
            storage_key="test/prior",
            sha256_hash="1" * 64,
            mime_type="image/png",
            byte_size=1024,
        )
        curr_src = SourceFile(
            id=curr_id,
            workspace_id=self.workspace_id,
            case_id=self.case_id,
            filename="curr.png",
            file_kind="image_png",
            storage_key="test/curr",
            sha256_hash="2" * 64,
            mime_type="image/png",
            byte_size=1024,
        )

        mock_db = AsyncMock()
        mock_db.add = MagicMock()
        mock_res = MagicMock()
        mock_res.scalars.return_value.all.return_value = [prior_src, curr_src]
        mock_db.execute.return_value = mock_res

        req = TriggerLongitudinalXrayRequest(
            prior_source_file_id=prior_id,
            current_source_file_id=curr_id,
            clinical_question="Assess change in cardiomegaly",
        )

        res = await trigger_longitudinal_xray_run(
            req=req,
            case=self.case,
            principal=self.principal,
            db=mock_db,
        )

        self.assertEqual(res["status"], "queued")
        self.assertEqual(res["task_type"], "xray_longitudinal")
        self.assertIn("run_id", res)
        self.assertEqual(mock_db.add.call_count, 2)
        self.assertTrue(mock_db.commit.called)

    async def test_trigger_longitudinal_xray_same_file_fails(self) -> None:
        same_id = uuid.uuid4()
        req = TriggerLongitudinalXrayRequest(
            prior_source_file_id=same_id,
            current_source_file_id=same_id,
        )
        mock_db = AsyncMock()

        with self.assertRaises(HTTPException) as ctx:
            await trigger_longitudinal_xray_run(
                req=req,
                case=self.case,
                principal=self.principal,
                db=mock_db,
            )
        self.assertEqual(ctx.exception.status_code, 400)


if __name__ == "__main__":
    unittest.main()
