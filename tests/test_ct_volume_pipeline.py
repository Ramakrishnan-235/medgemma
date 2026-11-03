import unittest
import numpy as np
from PIL import Image

from app.services.ct_volume_pipeline import (
    generate_synthetic_3d_ct_volume,
    compute_3d_quantification,
    compute_z_axis_attention_scores,
    sample_sparse_attention_slices,
    window_to_rgb,
    main,
)


class TestCTVolumePipeline(unittest.TestCase):
    def test_window_to_rgb(self):
        slice_hu = np.array([
            [-200.0, 40.0],
            [240.0, 500.0]
        ], dtype=np.float32)
        img = window_to_rgb(slice_hu, center=40.0, width=400.0)
        self.assertIsInstance(img, Image.Image)
        self.assertEqual(img.mode, "RGB")
        self.assertEqual(img.size, (2, 2))

        # Check mapping: min is -160 (mapped to 0), max is 240 (mapped to 255)
        # -200 is clipped to -160 -> 0
        # 40 is halfway -> (40 - (-160)) / 400 * 255 = 200/400 * 255 = 127
        # 240 and 500 clipped to 240 -> 255
        arr = np.array(img)
        self.assertEqual(arr[0, 0, 0], 0)
        self.assertEqual(arr[0, 1, 0], 127)
        self.assertEqual(arr[1, 0, 0], 255)
        self.assertEqual(arr[1, 1, 0], 255)

    def test_compute_3d_quantification_empty_mask(self):
        vol = np.zeros((10, 32, 32), dtype=np.float32)
        mask = np.zeros((10, 32, 32), dtype=np.uint8)
        metrics = compute_3d_quantification(vol, mask, (1.0, 1.0, 1.0))
        self.assertEqual(metrics, {})

    def test_compute_3d_quantification_known_roi(self):
        vol = np.zeros((10, 20, 20), dtype=np.float32)
        mask = np.zeros((10, 20, 20), dtype=np.uint8)
        # Place a 2x3x4 ROI at z=3..4, y=5..7, x=10..13
        vol[3:5, 5:8, 10:14] = 42.0
        mask[3:5, 5:8, 10:14] = 1

        spacing = (0.5, 0.5, 1.0)  # dx=0.5, dy=0.5, dz=1.0
        metrics = compute_3d_quantification(vol, mask, spacing)

        self.assertIn("dimensions_str", metrics)
        self.assertIn("volume_cm3", metrics)
        self.assertIn("mean_hu", metrics)
        self.assertEqual(metrics["mean_hu"], 42.0)
        self.assertEqual(metrics["z_span_mm"], 2.0)
        # 2 * 3 * 4 = 24 voxels, voxel vol = 0.5 * 0.5 * 1.0 / 1000 = 0.00025 cm3, 24 * 0.00025 = 0.006 cm3 -> round 0.01
        self.assertEqual(metrics["volume_cm3"], 0.01)
        self.assertIn(metrics["peak_slice"], [3, 4])

    def test_compute_z_axis_attention_scores_and_sampling(self):
        num_slices = 160
        mask = np.zeros((num_slices, 64, 64), dtype=np.uint8)
        # Add lesion around slice 64
        mask[60:68, 30:35, 30:35] = 1

        scores = compute_z_axis_attention_scores(mask, num_slices=num_slices)
        self.assertEqual(len(scores), num_slices)
        self.assertTrue((scores >= 0.0).all() and (scores <= 1.0).all())
        # Peak score should be in [60, 67]
        peak_idx = int(np.argmax(scores))
        self.assertTrue(60 <= peak_idx <= 67)

        sampled = sample_sparse_attention_slices(scores, target_count=64)
        self.assertEqual(len(sampled), 64)
        self.assertEqual(sampled, sorted(sampled))
        # Ensure peak slice is sampled
        self.assertIn(peak_idx, sampled)

    def test_synthetic_3d_ct_volume_generation(self):
        vol_hu, roi_mask, spacing = generate_synthetic_3d_ct_volume(
            num_slices=100, rows=128, cols=128, dx=1.0, dy=1.0, dz=1.5
        )
        self.assertEqual(vol_hu.shape, (100, 128, 128))
        self.assertEqual(roi_mask.shape, (100, 128, 128))
        self.assertEqual(spacing, (1.0, 1.0, 1.5))
        # Check that ROI exists and is centered near slice 64
        self.assertGreater(np.count_nonzero(roi_mask), 0)
        z_indices = np.where(roi_mask > 0)[0]
        self.assertTrue(50 <= np.mean(z_indices) <= 75)

    def test_main_pipeline_execution(self):
        # Verify that main() runs end-to-end and returns the structured payload
        payload = main()
        self.assertEqual(payload["model"], "google/medgemma-1.5-4b")
        self.assertEqual(payload["num_slices_sampled"], 64)
        self.assertEqual(payload["roi_telemetry"]["id"], "CT-ROI-01")
        self.assertIn("Axial Slice 64", payload["roi_telemetry"]["location"])
