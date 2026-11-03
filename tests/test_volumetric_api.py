import unittest

from fastapi.testclient import TestClient

from app.main import app


class TestVolumetricAPI(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_status_endpoint(self):
        resp = self.client.get("/api/v1/volumetric/status")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["status"], "online")
        self.assertEqual(data["cluster_online_percent"], 99.8)
        self.assertEqual(data["sampled_slices_count"], 64)

    def test_analyze_mri_volume(self):
        resp = self.client.post("/api/v1/volumetric/analyze-volume?modality=3d_mri&sequence_preset=t2_weighted&active_slice=64")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["modality"], "3d_mri")
        self.assertEqual(data["primary_roi"]["id"], "MRI-ROI-01")
        self.assertEqual(data["primary_roi"]["mean_hu"], 42)
        self.assertEqual(data["sampled_slices_count"], 64)
        self.assertEqual(len(data["z_attention_scores"]), 48)
        self.assertIn("3.0 Tesla", data["scanner_telemetry"]["field_strength"])
        self.assertIn("T2 TSE", data["scanner_telemetry"]["sequence"])

    def test_analyze_ct_volume_alias(self):
        resp = self.client.post("/api/v1/ct/analyze-volume?case_id=CASE-2026-0894")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["modality"], "3d_ct")
        self.assertEqual(data["primary_roi"]["id"], "CT-ROI-01")
        self.assertEqual(data["case_id"], "CASE-2026-0894")

    def test_export_manifest(self):
        resp = self.client.post("/api/v1/volumetric/export-manifest?case_id=CASE-2026-0894&modality=3d_mri")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["standard"], "DICOM-SEG / NIfTI-1 v1.0")
        self.assertEqual(data["modality"], "MR")
        self.assertEqual(data["target_roi_id"], "MRI-ROI-01")


if __name__ == "__main__":
    unittest.main()

