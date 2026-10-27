import base64
import io
from dataclasses import asdict, dataclass
from datetime import date
from typing import Any

import numpy as np
import pydicom
from dateutil import parser as date_parser
from PIL import Image
from pydicom.pixels import apply_modality_lut, apply_voi_lut

SUPPORTED_XRAY_MODALITIES = {"CR", "DX", "RG", "OT"}
MEDGEMMA_TARGET_SIZE = 896


@dataclass(frozen=True)
class LetterboxTransform:
    orig_width: int
    orig_height: int
    target_size: int
    scale: float
    pad_left: int
    pad_top: int
    resized_width: int
    resized_height: int


@dataclass
class NormalizedXrayResult:
    display_png_bytes: bytes
    medgemma_896_png_bytes: bytes
    medgemma_896_b64: str
    letterbox: LetterboxTransform
    dicom_metadata: dict[str, Any]


def compute_letterbox_transform(
    orig_width: int, orig_height: int, target_size: int = MEDGEMMA_TARGET_SIZE
) -> LetterboxTransform:
    orig_w = max(int(orig_width), 1)
    orig_h = max(int(orig_height), 1)
    scale = min(target_size / float(orig_w), target_size / float(orig_h))
    resized_w = int(round(orig_w * scale))
    resized_h = int(round(orig_h * scale))
    pad_left = (target_size - resized_w) // 2
    pad_top = (target_size - resized_h) // 2
    return LetterboxTransform(
        orig_width=orig_w,
        orig_height=orig_h,
        target_size=target_size,
        scale=scale,
        pad_left=pad_left,
        pad_top=pad_top,
        resized_width=resized_w,
        resized_height=resized_h,
    )


def apply_letterbox_896(pil_img: Image.Image) -> tuple[Image.Image, LetterboxTransform]:
    orig_w, orig_h = pil_img.size
    tf = compute_letterbox_transform(orig_w, orig_h, MEDGEMMA_TARGET_SIZE)
    resized = pil_img.resize((tf.resized_width, tf.resized_height), resample=Image.Resampling.BICUBIC)
    canvas = Image.new("RGB", (tf.target_size, tf.target_size), color=(0, 0, 0))
    canvas.paste(resized, (tf.pad_left, tf.pad_top))
    return canvas, tf


def map_medgemma_box_to_source_norm(
    box_1000: list[float] | tuple[float, float, float, float],
    tf_dict: dict[str, Any],
) -> dict[str, float] | None:
    """
    Maps MedGemma [ymin, xmin, ymax, xmax] in [0..1000] on the 896x896 padded canvas
    back to top-left normalized {"x0", "y0", "x1", "y1"} in [0.0..1.0] on the original X-ray.
    """
    if len(box_1000) != 4:
        return None
    try:
        ymin_k, xmin_k, ymax_k, xmax_k = [float(v) for v in box_1000]
        target = float(tf_dict.get("target_size", MEDGEMMA_TARGET_SIZE))
        pad_left = float(tf_dict.get("pad_left", 0))
        pad_top = float(tf_dict.get("pad_top", 0))
        resized_w = max(float(tf_dict.get("resized_width", target)), 1.0)
        resized_h = max(float(tf_dict.get("resized_height", target)), 1.0)
    except (ValueError, TypeError, KeyError):
        return None

    # Convert [0..1000] -> pixel coordinates in 896x896 canvas -> subtract letterbox padding
    x0_unpadded = ((xmin_k / 1000.0) * target - pad_left) / resized_w
    y0_unpadded = ((ymin_k / 1000.0) * target - pad_top) / resized_h
    x1_unpadded = ((xmax_k / 1000.0) * target - pad_left) / resized_w
    y1_unpadded = ((ymax_k / 1000.0) * target - pad_top) / resized_h

    # Re-order in case model outputs inverted coordinates
    x_min, x_max = min(x0_unpadded, x1_unpadded), max(x0_unpadded, x1_unpadded)
    y_min, y_max = min(y0_unpadded, y1_unpadded), max(y0_unpadded, y1_unpadded)

    x0 = round(max(0.0, min(1.0, x_min)), 4)
    y0 = round(max(0.0, min(1.0, y_min)), 4)
    x1 = round(max(0.0, min(1.0, x_max)), 4)
    y1 = round(max(0.0, min(1.0, y_max)), 4)

    if (x1 - x0) < 0.01 or (y1 - y0) < 0.01:
        return None
    return {"x0": x0, "y0": y0, "x1": x1, "y1": y1}


def _parse_dicom_study_date(raw_date: str | None) -> str | None:
    if not raw_date:
        return None
    try:
        dt = date_parser.parse(str(raw_date).strip()).date()
        if 1970 <= dt.year <= date.today().year + 1:
            return dt.isoformat()
    except (ValueError, OverflowError):
        return None
    return None


class ChestXrayPreprocessor:
    """
    Normalizes single-frame DICOM (.dcm) and PNG/JPEG Chest X-rays for both
    Cornerstone3D display and 896x896 MedGemma 1.5 4B inference.
    """

    def normalize_dicom_bytes(self, raw_bytes: bytes) -> NormalizedXrayResult:
        ds = pydicom.dcmread(io.BytesIO(raw_bytes))

        modality = str(getattr(ds, "Modality", "OT")).upper().strip()
        if modality not in SUPPORTED_XRAY_MODALITIES:
            raise ValueError(f"Unsupported DICOM Modality '{modality}' for MVP Chest X-ray workflow.")

        num_frames = int(getattr(ds, "NumberOfFrames", 1) or 1)
        if num_frames > 1:
            raise ValueError(f"Multi-frame DICOM ({num_frames} frames) requires the volumetric extension.")

        raw_pixels = ds.pixel_array
        if raw_pixels.ndim == 3 and raw_pixels.shape[0] == 1:
            raw_pixels = raw_pixels[0]
        elif raw_pixels.ndim == 3 and raw_pixels.shape[-1] == 1:
            raw_pixels = raw_pixels[:, :, 0]

        # 1. Apply Modality LUT (RescaleSlope / RescaleIntercept) and VOI LUT (WindowCenter / WindowWidth)
        try:
            hu_pixels = apply_modality_lut(raw_pixels, ds)
        except Exception:
            hu_pixels = raw_pixels
        try:
            windowed = apply_voi_lut(hu_pixels, ds).astype(np.float32)
        except Exception:
            windowed = hu_pixels.astype(np.float32)

        # 2. Invert MONOCHROME1 (where 0 is white) to standard MONOCHROME2 (0 is black)
        photometric = str(getattr(ds, "PhotometricInterpretation", "MONOCHROME2")).upper().strip()
        if photometric == "MONOCHROME1":
            windowed = np.max(windowed) - windowed

        # 3. Robust 8-bit dynamic range scaling (0.5 to 99.5 percentile clipping if flat)
        p_low, p_high = np.percentile(windowed, (0.5, 99.5))
        if p_high <= p_low:
            p_low, p_high = float(np.min(windowed)), float(np.max(windowed))
        clipped = np.clip(windowed, p_low, p_high)
        norm_uint8 = ((clipped - p_low) / max(p_high - p_low, 1e-6) * 255.0).astype(np.uint8)

        pil_rgb = Image.fromarray(norm_uint8).convert("RGB")

        pixel_spacing_val = getattr(ds, "PixelSpacing", getattr(ds, "ImagerPixelSpacing", [1.0, 1.0]))
        try:
            pixel_spacing = [float(x) for x in pixel_spacing_val]
        except Exception:
            pixel_spacing = [1.0, 1.0]

        orientation = getattr(ds, "PatientOrientation", [])
        if isinstance(orientation, (list, tuple)):
            patient_orientation = list(orientation)
        else:
            patient_orientation = [str(orientation)] if orientation else []

        rows_val = getattr(ds, "Rows", pil_rgb.height) or pil_rgb.height
        cols_val = getattr(ds, "Columns", pil_rgb.width) or pil_rgb.width

        return self._package_result(
            pil_rgb=pil_rgb,
            metadata={
                "modality": modality,
                "photometric_interpretation": "MONOCHROME2",
                "original_photometric": photometric,
                "view_position": str(getattr(ds, "ViewPosition", "UNKNOWN")).upper().strip(),
                "patient_orientation": patient_orientation,
                "rows": int(rows_val),
                "columns": int(cols_val),
                "pixel_spacing": pixel_spacing,
                "window_center": float(p_low + (p_high - p_low) / 2.0),
                "window_width": float(max(p_high - p_low, 1.0)),
                "encounter_date": _parse_dicom_study_date(getattr(ds, "StudyDate", None)),
            },
        )

    def normalize_standard_image_bytes(self, raw_bytes: bytes) -> NormalizedXrayResult:
        pil_rgb = Image.open(io.BytesIO(raw_bytes)).convert("RGB")
        return self._package_result(
            pil_rgb=pil_rgb,
            metadata={
                "modality": "DX",
                "photometric_interpretation": "MONOCHROME2",
                "view_position": "UNKNOWN",
                "rows": pil_rgb.height,
                "columns": pil_rgb.width,
                "pixel_spacing": [1.0, 1.0],
                "window_center": 128.0,
                "window_width": 255.0,
                "encounter_date": None,
            },
        )

    def _package_result(self, pil_rgb: Image.Image, metadata: dict[str, Any]) -> NormalizedXrayResult:
        display_buf = io.BytesIO()
        pil_rgb.save(display_buf, format="PNG", optimize=True)
        display_bytes = display_buf.getvalue()

        padded_896, letterbox = apply_letterbox_896(pil_rgb)
        buf_896 = io.BytesIO()
        padded_896.save(buf_896, format="PNG", optimize=True)
        bytes_896 = buf_896.getvalue()

        metadata["letterbox_transform"] = asdict(letterbox)
        return NormalizedXrayResult(
            display_png_bytes=display_bytes,
            medgemma_896_png_bytes=bytes_896,
            medgemma_896_b64=base64.b64encode(bytes_896).decode("ascii"),
            letterbox=letterbox,
            dicom_metadata=metadata,
        )
