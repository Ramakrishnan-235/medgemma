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
        self.assertNotIn("slice Axial slice", data["findings_markdown"])

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

    def test_targeted_slice_vqa_mri_endpoint(self):
        payload = {
            "case_id": "CASE-2026-0894",
            "slice_index": 64,
            "tissue_window": "t2_weighted",
            "question": "Describe the lesion on slice 64",
        }
        resp = self.client.post("/api/v1/volumetric/vqa", json=payload)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["slice_index"], 64)
        self.assertGreater(data["confidence_score"], 0.8)


    def test_slice_visual_grounding_endpoint(self):
        resp = self.client.get("/api/v1/volumetric/grounding?case_id=CASE-2026-0894&slice_index=64&modality=3d_ct")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(len(data) >= 1)
        self.assertIn("box_1000", data[0])
        self.assertGreater(data[0]["box_1000"]["ymax"], data[0]["box_1000"]["ymin"])

    def test_dag_pipeline_endpoint(self):
        payload = {
            "study_id": "STUDY-TEST-DAG-99",
            "max_slices": 32,
            "stream_report": False,
            "mock_mode": True,
        }
        resp = self.client.post("/api/v1/ct/dag-pipeline", json=payload)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["status"], "success")
        self.assertEqual(data["study_id"], "STUDY-TEST-DAG-99")
        self.assertEqual(data["slices_processed"], 32)
        self.assertEqual(data["token_budget"], 32 * 256)
        self.assertIn("output_b_lung_rads", data)
        self.assertIn("output_d_detections", data)
        self.assertTrue(len(data["output_d_detections"]) > 0)
        first_det = data["output_d_detections"][0]
        self.assertIn("physical_size", first_det)
        self.assertIn("monai_3d_volume", first_det)
        self.assertGreater(first_det["monai_3d_volume"]["volume_mm3"], 0)
        self.assertIn("output_a_narrative_report", data)
        self.assertIn("Findings", data["output_a_narrative_report"])

    def test_vqa_stream_endpoint(self):
        payload = {
            "study_id": "STUDY-TEST-DAG-99",
            "question": "What is the nodule volume and Lung-RADS score?",
            "mock_mode": True,
        }
        resp = self.client.post("/api/v1/ct/vqa-stream", json=payload)
        self.assertEqual(resp.status_code, 200)
        self.assertIn("text/event-stream", resp.headers["content-type"])
        self.assertIn("data:", resp.text)
        self.assertIn("[DONE]", resp.text)



if __name__ == "__main__":
    unittest.main()

