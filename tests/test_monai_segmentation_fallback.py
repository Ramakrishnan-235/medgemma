import os
import sys
import numpy as np
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "api")))

from app.services.monai_segmentation_fallback import compute_cubic_mm_volume


def test_compute_cubic_mm_volume_synthetic():
    # Synthetic 3D CT subvolume: 32 slices, 64x64 matrix
    vol = np.full((32, 64, 64), -1000.0, dtype=np.float32)

    # Inject spherical nodule at slice 16, y=32, x=32 with radius 4 voxels (HU = 40.0)
    Y, X = np.ogrid[:64, :64]
    for z in range(12, 21):
        dz = abs(z - 16)
        r_slice_sq = 16 - dz**2
        if r_slice_sq > 0:
            mask = ((X - 32)**2 + (Y - 32)**2) <= r_slice_sq
            vol[z, mask] = 40.0

    spacing = (1.0, 1.0, 1.5)  # dx=1.0, dy=1.0, dz=1.5 mm

    # Detection box around y=32, x=32 in normalized 0..1000 space
    # 26/64 = 406, 38/64 = 594
    detection = {
        "slice_index": 16,
        "box_2d": [406, 406, 594, 594],
        "label": "Pulmonary Nodule",
    }

    result = compute_cubic_mm_volume(vol, spacing, detection)
    assert result["volume_mm3"] > 0
    assert result["volume_cm3"] > 0
    assert result["mean_hu"] == pytest.approx(40.0, abs=1.0)
    assert result["voxel_count"] > 0
    assert result["method"] in ["monai_vista3d_hook", "monai_active_contour_fallback"]

