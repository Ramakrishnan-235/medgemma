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

    def test_free_form_radiology_report_endpoint(self):
        resp = self.client.post("/api/v1/volumetric/reports/free-form?case_id=CASE-2026-0894&modality=3d_ct")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["case_id"], "CASE-2026-0894")
        self.assertIn("FINDINGS", data["findings_markdown"])
        self.assertIn("IMPRESSION", data["impression_markdown"])
        self.assertIn("Lungs/Pleura", data["organ_observations"])

    def test_longitudinal_comparison_endpoint(self):
        resp = self.client.post("/api/v1/volumetric/reports/longitudinal?case_id=CASE-2026-0894&prior_study_date=2026-01-15&current_study_date=2026-04-20")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["interval_days"], 95)
        self.assertEqual(data["recist_category"], "Progressive Disease")
        self.assertGreater(data["diameter_change_mm"], 0)

    def test_fhir_diagnostic_bundle_endpoint(self):
        resp = self.client.post("/api/v1/volumetric/fhir/diagnostic-bundle?case_id=CASE-2026-0894&patient_id=PAT-9842")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["resourceType"], "Bundle")
        self.assertEqual(data["type"], "transaction")
        self.assertTrue(len(data["entry"]) >= 4)
        report_entry = next(e["resource"] for e in data["entry"] if e["resource"]["resourceType"] == "DiagnosticReport")
        self.assertEqual(report_entry["code"]["coding"][0]["code"], "24627-2")

    def test_diagnostic_classifications_endpoint(self):
        resp = self.client.post("/api/v1/volumetric/classifications?case_id=CASE-2026-0894&diameter_mm=9.5")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("lung_rads", data)
        self.assertEqual(data["lung_rads"]["category"], "4A")
        self.assertIn("ct_rate_abnormalities", data)
        self.assertEqual(len(data["ct_rate_abnormalities"]), 18)
        self.assertIn("nodule", data["detected_conditions"])

    def test_targeted_slice_vqa_endpoint(self):
        payload = {
            "case_id": "CASE-2026-0894",
            "slice_index": 64,
            "tissue_window": "soft_tissue",
            "question": "Describe the lesion on slice 64",
        }
        resp = self.client.post("/api/v1/volumetric/vqa", json=payload)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["slice_index"], 64)
        self.assertGreater(data["confidence_score"], 0.8)
        self.assertIn("answer_markdown", data)
        self.assertIsNotNone(data["grounded_box"])

    def test_slice_visual_grounding_endpoint(self):
        resp = self.client.get("/api/v1/volumetric/grounding?case_id=CASE-2026-0894&slice_index=64&modality=3d_ct")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(len(data) >= 1)
        self.assertIn("box_1000", data[0])
        self.assertGreater(data[0]["box_1000"]["ymax"], data[0]["box_1000"]["ymin"])



if __name__ == "__main__":
    unittest.main()

