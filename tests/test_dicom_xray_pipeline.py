import io
import os
import sys
import unittest
from dataclasses import asdict
from unittest.mock import MagicMock

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "api")))

from app.services.dicom_xray_pipeline import (
    ChestXrayPreprocessor,
    LetterboxTransform,
    _parse_dicom_study_date,
    apply_letterbox_896,
    compute_letterbox_transform,
    map_medgemma_box_to_source_norm,
)


class TestDicomXrayPipeline(unittest.TestCase):
    def test_compute_letterbox_transform_tall(self) -> None:
        # 2048 x 2500 tall chest x-ray
        tf = compute_letterbox_transform(2048, 2500, target_size=896)
        self.assertEqual(tf.orig_width, 2048)
        self.assertEqual(tf.orig_height, 2500)
        self.assertEqual(tf.target_size, 896)
        self.assertEqual(tf.resized_height, 896)
        self.assertLess(tf.resized_width, 896)
        self.assertGreater(tf.pad_left, 0)
        self.assertEqual(tf.pad_top, 0)

    def test_compute_letterbox_transform_wide(self) -> None:
        # 3000 x 2000 wide radiograph
        tf = compute_letterbox_transform(3000, 2000, target_size=896)
        self.assertEqual(tf.resized_width, 896)
        self.assertLess(tf.resized_height, 896)
        self.assertEqual(tf.pad_left, 0)
        self.assertGreater(tf.pad_top, 0)

    def test_apply_letterbox_896(self) -> None:
        img = Image.new("RGB", (1000, 2000), color=(100, 150, 200))
        canvas, tf = apply_letterbox_896(img)
        self.assertEqual(canvas.size, (896, 896))
        self.assertEqual(tf.target_size, 896)
        # Check padding pixel is black (0, 0, 0)
        self.assertEqual(canvas.getpixel((0, 0)), (0, 0, 0))

    def test_map_medgemma_box_to_source_norm_square(self) -> None:
        tf = compute_letterbox_transform(1000, 1000, target_size=896)
        # Box [ymin, xmin, ymax, xmax] in [0..1000]
        mapped = map_medgemma_box_to_source_norm([100, 200, 600, 700], asdict(tf))
        self.assertIsNotNone(mapped)
        assert mapped is not None
        self.assertAlmostEqual(mapped["x0"], 0.2, places=2)
        self.assertAlmostEqual(mapped["y0"], 0.1, places=2)
        self.assertAlmostEqual(mapped["x1"], 0.7, places=2)
        self.assertAlmostEqual(mapped["y1"], 0.6, places=2)

    def test_map_medgemma_box_tiny_or_invalid(self) -> None:
        tf = compute_letterbox_transform(1000, 1000, target_size=896)
        # Degenerate zero-size box
        self.assertIsNone(map_medgemma_box_to_source_norm([100, 100, 100, 100], asdict(tf)))
        # Length not 4
        self.assertIsNone(map_medgemma_box_to_source_norm([100, 100, 200], asdict(tf)))

    def test_parse_dicom_study_date(self) -> None:
        self.assertEqual(_parse_dicom_study_date("20231120"), "2023-11-20")
        self.assertEqual(_parse_dicom_study_date("2024-05-12"), "2024-05-12")
        self.assertIsNone(_parse_dicom_study_date("invalid_date"))
        self.assertIsNone(_parse_dicom_study_date(None))
        self.assertIsNone(_parse_dicom_study_date("18500101"))  # Year < 1970

    def test_normalize_standard_image_bytes(self) -> None:
        preprocessor = ChestXrayPreprocessor()
        img = Image.new("RGB", (640, 480), color=(128, 128, 128))
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        png_bytes = buf.getvalue()

        result = preprocessor.normalize_standard_image_bytes(png_bytes)
        self.assertIsNotNone(result.display_png_bytes)
        self.assertIsNotNone(result.medgemma_896_png_bytes)
        self.assertGreater(len(result.medgemma_896_b64), 0)
        self.assertEqual(result.dicom_metadata["rows"], 480)
        self.assertEqual(result.dicom_metadata["columns"], 640)
        self.assertEqual(result.letterbox.target_size, 896)

    def test_normalize_dicom_synthetic(self) -> None:
        import pydicom
        from pydicom.dataset import FileDataset, FileMetaDataset
        from pydicom.uid import ExplicitVRLittleEndian, generate_uid

        # Build an in-memory valid DICOM dataset
        file_meta = FileMetaDataset()
        file_meta.MediaStorageSOPClassUID = "1.2.840.10008.5.1.4.1.1.1"  # CR Image Storage
        file_meta.MediaStorageSOPInstanceUID = generate_uid()
        file_meta.TransferSyntaxUID = ExplicitVRLittleEndian

        ds = FileDataset("test.dcm", {}, file_meta=file_meta, preamble=b"\0" * 128)
        ds.Modality = "DX"
        ds.NumberOfFrames = 1
        ds.PhotometricInterpretation = "MONOCHROME2"
        ds.Rows = 64
        ds.Columns = 64
        ds.BitsAllocated = 16
        ds.BitsStored = 12
        ds.HighBit = 11
        ds.PixelRepresentation = 0
        ds.SamplesPerPixel = 1
        ds.ViewPosition = "PA"
        ds.StudyDate = "20240315"
        ds.PixelSpacing = [0.15, 0.15]

        # 64x64 synthetic gradient pixels
        pixels = np.linspace(100, 2000, 64 * 64, dtype=np.uint16).reshape((64, 64))
        ds.PixelData = pixels.tobytes()

        buf = io.BytesIO()
        ds.save_as(buf, enforce_file_format=True)
        dcm_bytes = buf.getvalue()

        preprocessor = ChestXrayPreprocessor()
        res = preprocessor.normalize_dicom_bytes(dcm_bytes)
        self.assertEqual(res.dicom_metadata["modality"], "DX")
        self.assertEqual(res.dicom_metadata["view_position"], "PA")
        self.assertEqual(res.dicom_metadata["encounter_date"], "2024-03-15")
        self.assertEqual(res.letterbox.target_size, 896)

    def test_normalize_dicom_unsupported_modality(self) -> None:
        import pydicom
        from pydicom.dataset import FileDataset, FileMetaDataset
        from pydicom.uid import ExplicitVRLittleEndian, generate_uid

        file_meta = FileMetaDataset()
        file_meta.MediaStorageSOPClassUID = "1.2.840.10008.5.1.4.1.1.2"
        file_meta.MediaStorageSOPInstanceUID = generate_uid()
        file_meta.TransferSyntaxUID = ExplicitVRLittleEndian
        ds = FileDataset("test_ct.dcm", {}, file_meta=file_meta, preamble=b"\0" * 128)

        ds.Modality = "CT"  # Unsupported for MVP Chest X-ray
        ds.Rows = 16
        ds.Columns = 16
        ds.PixelData = np.zeros((16, 16), dtype=np.uint16).tobytes()

        buf = io.BytesIO()
        ds.save_as(buf, enforce_file_format=True)

        preprocessor = ChestXrayPreprocessor()
        with self.assertRaises(ValueError) as ctx:
            preprocessor.normalize_dicom_bytes(buf.getvalue())
        self.assertIn("Unsupported DICOM Modality", str(ctx.exception))

    def test_compute_letterbox_transform_zero_or_negative(self) -> None:
        tf = compute_letterbox_transform(0, -10, target_size=896)
        self.assertGreaterEqual(tf.orig_width, 1)
        self.assertGreaterEqual(tf.orig_height, 1)
        self.assertEqual(tf.target_size, 896)

    def test_map_medgemma_box_to_source_norm_inverted(self) -> None:
        tf = compute_letterbox_transform(1000, 1000, target_size=896)
        # Box with inverted ymin > ymax and xmin > xmax
        mapped = map_medgemma_box_to_source_norm([600, 700, 100, 200], asdict(tf))
        self.assertIsNotNone(mapped)
        assert mapped is not None
        self.assertAlmostEqual(mapped["x0"], 0.2, places=2)
        self.assertAlmostEqual(mapped["y0"], 0.1, places=2)
        self.assertAlmostEqual(mapped["x1"], 0.7, places=2)
        self.assertAlmostEqual(mapped["y1"], 0.6, places=2)

    def test_normalize_dicom_trailing_channel_dimension(self) -> None:
        import pydicom
        from pydicom.dataset import FileDataset, FileMetaDataset
        from pydicom.uid import ExplicitVRLittleEndian, generate_uid

        file_meta = FileMetaDataset()
        file_meta.MediaStorageSOPClassUID = "1.2.840.10008.5.1.4.1.1.1"
        file_meta.MediaStorageSOPInstanceUID = generate_uid()
        file_meta.TransferSyntaxUID = ExplicitVRLittleEndian

        ds = FileDataset("test_dx.dcm", {}, file_meta=file_meta, preamble=b"\0" * 128)
        ds.Modality = "DX"
        ds.NumberOfFrames = 1
        ds.PhotometricInterpretation = "MONOCHROME2"
        ds.Rows = 32
        ds.Columns = 32
        ds.BitsAllocated = 16
        ds.BitsStored = 12
        ds.HighBit = 11
        ds.PixelRepresentation = 0
        ds.SamplesPerPixel = 1
        ds.PixelData = np.ones((32, 32), dtype=np.uint16).tobytes()

        buf = io.BytesIO()
        ds.save_as(buf, enforce_file_format=True)

        preprocessor = ChestXrayPreprocessor()
        res = preprocessor.normalize_dicom_bytes(buf.getvalue())
        self.assertEqual(res.dicom_metadata["rows"], 32)
        self.assertEqual(res.dicom_metadata["columns"], 32)


if __name__ == "__main__":
    unittest.main()
