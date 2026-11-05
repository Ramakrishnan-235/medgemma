import os
import sys
import numpy as np
import pytest
from PIL import Image

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "api")))

from app.services.preprocess_ct import (
    apply_hu_window,
    process_raw_hu_volume_for_medgemma,
    process_ct_series_for_medgemma,
)


def test_apply_hu_window():
    # Lung window: center=-600, width=1500 -> range [-1350, +150]
    slice_data = np.array([-1500, -1350, -600, 150, 500], dtype=np.float32)
    windowed = apply_hu_window(slice_data, center=-600, width=1500)
    assert windowed.dtype == np.uint8
    assert windowed[0] == 0       # Clipped to lower bound
    assert windowed[1] == 0       # Lower boundary
    assert 126 <= windowed[2] <= 128  # Midpoint ~127
    assert windowed[3] == 255     # Upper boundary
    assert windowed[4] == 255     # Clipped to upper bound


def test_process_raw_hu_volume_for_medgemma():
    # Synthetic volume: 10 slices of 64x64
    vol = np.zeros((10, 64, 64), dtype=np.float32)
    vol[2, :, :] = -600.0   # Lung slice
    vol[5, :, :] = 400.0    # Bone slice
    spacing = (0.75, 0.75, 1.5)

    images, meta = process_raw_hu_volume_for_medgemma(vol, spacing, max_slices=8)
    assert len(images) == 8
    assert all(img.size == (896, 896) for img in images)
    assert meta["pixel_spacing_mm"] == [0.75, 0.75]
    assert meta["original_shape"] == [64, 64]
    assert meta["slice_thickness_mm"] == 1.5
    assert len(meta["slice_z_mm"]) == 8


def test_process_ct_series_synthetic_dicom(tmp_path):
    import pydicom
    from pydicom.dataset import FileDataset, FileMetaDataset
    from pydicom.uid import ExplicitVRLittleEndian, SecondaryCaptureImageStorage

    # Create 3 synthetic DICOM files with out-of-order Z positions to test Z-sorting
    z_positions = [20.0, -10.0, 5.0]
    for idx, z in enumerate(z_positions):
        filename = tmp_path / f"slice_{idx}.dcm"
        file_meta = FileMetaDataset()
        file_meta.MediaStorageSOPClassUID = SecondaryCaptureImageStorage
        file_meta.MediaStorageSOPInstanceUID = pydicom.uid.generate_uid()
        file_meta.TransferSyntaxUID = ExplicitVRLittleEndian

        ds = FileDataset(str(filename), {}, file_meta=file_meta, preamble=b"\0" * 128)
        ds.is_little_endian = True
        ds.is_implicit_VR = False
        ds.Modality = "CT"
        ds.PatientName = "ANONYMOUS^TEST"
        ds.Rows = 32
        ds.Columns = 32
        ds.SamplesPerPixel = 1
        ds.PhotometricInterpretation = "MONOCHROME2"
        ds.PixelSpacing = [0.8, 0.8]
        ds.SliceThickness = 2.0
        ds.ImagePositionPatient = [0.0, 0.0, str(z)]
        ds.RescaleIntercept = "0"
        ds.RescaleSlope = "1"
        ds.PixelRepresentation = 0
        ds.BitsAllocated = 16
        ds.BitsStored = 16
        ds.HighBit = 15

        # Raw pixel array (HU = 0)
        pixel_array = np.zeros((32, 32), dtype=np.uint16)
        ds.PixelData = pixel_array.tobytes()
        ds.save_as(str(filename), write_like_original=False)

    images, meta = process_ct_series_for_medgemma(str(tmp_path), max_slices=3)
    assert len(images) == 3
    # Check that slices were sorted strictly ascending by Z
    assert meta["slice_z_mm"] == [-10.0, 5.0, 20.0]
    assert meta["pixel_spacing_mm"] == [0.8, 0.8]
    assert meta["original_shape"] == [32, 32]
    assert meta["slice_thickness_mm"] == 2.0
