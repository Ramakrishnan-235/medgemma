import os
from typing import Any, Dict, List, Tuple
import numpy as np
import pydicom
from PIL import Image

# DICOM PS3.15 Basic Application Level Confidentiality Profile Core PHI Tags
PHI_TAGS_TO_ANONYMIZE = [
    (0x0010, 0x0010),  # Patient's Name
    (0x0010, 0x0020),  # Patient ID
    (0x0010, 0x0030),  # Patient's Birth Date
    (0x0010, 0x0040),  # Patient's Sex
    (0x0010, 0x1000),  # Other Patient IDs
    (0x0010, 0x1010),  # Patient's Age
    (0x0010, 0x1040),  # Patient's Address
    (0x0008, 0x0080),  # Institution Name
    (0x0008, 0x0081),  # Institution Address
    (0x0008, 0x0090),  # Referring Physician's Name
    (0x0008, 0x1050),  # Performing Physician's Name
    (0x0008, 0x1070),  # Operators' Name
]


def scrub_dicom_phi(dataset: pydicom.Dataset) -> pydicom.Dataset:
    """Removes or redacts standard DICOM PS3.15 PHI attributes."""
    for tag in PHI_TAGS_TO_ANONYMIZE:
        if tag in dataset:
            elem = dataset[tag]
            if elem.VR in ("PN", "LO", "SH", "ST", "LT", "UT"):
                dataset[tag].value = "ANONYMIZED"
            elif elem.VR == "DA":
                dataset[tag].value = "19000101"
            elif elem.VR == "CS":
                dataset[tag].value = "O"
            else:
                del dataset[tag]
    return dataset


def apply_hu_window(hu_slice: np.ndarray, center: float, width: float) -> np.ndarray:
    """
    Applies linear window/level normalization to CT Hounsfield Units.
    Clips values outside [center - width/2, center + width/2] and maps to uint8 [0, 255].
    """
    lower = center - (width / 2.0)
    upper = center + (width / 2.0)
    windowed = np.clip(hu_slice, lower, upper)
    return ((windowed - lower) / (upper - lower) * 255.0).astype(np.uint8)


def create_3channel_hu_rgb_image(hu_slice: np.ndarray, target_size: Tuple[int, int] = (896, 896)) -> Image.Image:
    """
    Maps 3 diagnostic radiologic Hounsfield Unit windows into RGB channels:
    - Red Channel: Lung Window (Center: -600 HU, Width: 1500 HU)
    - Green Channel: Mediastinum/Soft Tissue Window (Center: 50 HU, Width: 350 HU)
    - Blue Channel: Bone Window (Center: 400 HU, Width: 1800 HU)
    Resizes output tensor to target_size (default 896x896 for MedSigLIP 256 tokens).
    """
    r_lung = apply_hu_window(hu_slice, center=-600.0, width=1500.0)
    g_mediastinum = apply_hu_window(hu_slice, center=50.0, width=350.0)
    b_bone = apply_hu_window(hu_slice, center=400.0, width=1800.0)

    rgb = np.stack([r_lung, g_mediastinum, b_bone], axis=-1)
    img = Image.fromarray(rgb)
    if img.size != target_size:
        img = img.resize(target_size, Image.Resampling.BILINEAR)
    return img


def process_ct_series_for_medgemma(
    dicom_dir: str,
    max_slices: int = 64,
    deidentify: bool = True,
) -> Tuple[List[Image.Image], Dict[str, Any]]:
    """
    Reads an axial CT DICOM series from directory, performs craniocaudal Z-sorting,
    applies uniform subsampling, encodes 3-channel HU RGB images, and extracts
    spatial affine metadata for physical coordinate conversion.
    """
    slices: List[pydicom.Dataset] = []
    for fname in os.listdir(dicom_dir):
        if not fname.lower().endswith(".dcm"):
            continue
        file_path = os.path.join(dicom_dir, fname)
        try:
            ds = pydicom.dcmread(file_path)
            if hasattr(ds, "ImagePositionPatient") and (hasattr(ds, "PixelData") or hasattr(ds, "pixel_array")):
                if deidentify:
                    ds = scrub_dicom_phi(ds)
                slices.append(ds)
        except Exception:
            continue

    if not slices:
        raise ValueError(f"No valid axial DICOM CT slices with ImagePositionPatient found in {dicom_dir}")

    # 1. Strict Z-Sorting along craniocaudal axis
    slices.sort(key=lambda s: float(s.ImagePositionPatient[2]))

    # 2. Uniform strided subsampling to adhere to vision token budget
    if len(slices) > max_slices:
        indices = np.linspace(0, len(slices) - 1, max_slices, dtype=int)
        slices = [slices[i] for i in indices]

    rgb_images: List[Image.Image] = []
    slice_z_coords: List[float] = []

    for s in slices:
        slope = float(getattr(s, "RescaleSlope", 1.0))
        intercept = float(getattr(s, "RescaleIntercept", 0.0))
        hu = s.pixel_array.astype(np.float32) * slope + intercept

        img = create_3channel_hu_rgb_image(hu, target_size=(896, 896))
        rgb_images.append(img)
        slice_z_coords.append(float(s.ImagePositionPatient[2]))

    first = slices[0]
    pixel_spacing = [float(x) for x in getattr(first, "PixelSpacing", [0.7, 0.7])]
    spatial_meta = {
        "pixel_spacing_mm": pixel_spacing,
        "original_shape": [int(first.Rows), int(first.Columns)],
        "slice_thickness_mm": float(getattr(first, "SliceThickness", 1.5)),
        "slice_z_mm": slice_z_coords,
    }
    return rgb_images, spatial_meta


def process_raw_hu_volume_for_medgemma(
    volume_hu: np.ndarray,
    spacing_xyz: Tuple[float, float, float] = (0.7, 0.7, 1.25),
    max_slices: int = 64,
) -> Tuple[List[Image.Image], Dict[str, Any]]:
    """
    Converts a 3D numpy CT volume (slices, rows, cols) in Hounsfield Units into
    an array of 3-channel HU RGB images (896x896) with corresponding spatial metadata.
    """
    total_slices, rows, cols = volume_hu.shape
    dx, dy, dz = spacing_xyz

    if total_slices > max_slices:
        indices = np.linspace(0, total_slices - 1, max_slices, dtype=int)
    else:
        indices = np.arange(total_slices, dtype=int)

    rgb_images: List[Image.Image] = []
    slice_z_coords: List[float] = []

    for idx in indices:
        hu_slice = volume_hu[idx].astype(np.float32)
        img = create_3channel_hu_rgb_image(hu_slice, target_size=(896, 896))
        rgb_images.append(img)
        slice_z_coords.append(float(idx * dz))

    spatial_meta = {
        "pixel_spacing_mm": [float(dy), float(dx)],  # [row_mm, col_mm]
        "original_shape": [int(rows), int(cols)],
        "slice_thickness_mm": float(dz),
        "slice_z_mm": slice_z_coords,
    }
    return rgb_images, spatial_meta
