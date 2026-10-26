import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Literal

VolumetricModality = Literal["CT", "MR", "PT"]


@dataclass(frozen=True)
class VolumetricSeriesDescriptor:
    source_file_id: uuid.UUID
    modality: VolumetricModality
    slice_count: int
    voxel_spacing_mm: tuple[float, float, float]  # (dz, dy, dx) in mm
    orientation_matrix: list[float]  # 9-element direction cosine matrix
    window_presets: dict[str, tuple[float, float]]  # e.g. {"lung": (-600, 1500), "mediastinum": (50, 350)}


@dataclass(frozen=True)
class SampledVolumetricSlab:
    """
    MedGemma 1.5 volumetric inference accepts an ordered sub-stack of 2D axial/coronal/sagittal
    slices normalized to 896x896 (each slice = 256 tokens).
    """
    slice_indices: list[int]
    normalized_slices_b64: list[str]
    anatomical_plane: Literal["axial", "coronal", "sagittal"]


class VolumetricSeriesAdapter(ABC):
    """
    Extension contract for Phase 2 CT/MRI NIfTI (.nii.gz) and multi-frame DICOM series.
    Implementations register with the worker pipeline without altering MVP tables.
    """

    @abstractmethod
    def inspect_series(self, raw_bytes: bytes) -> VolumetricSeriesDescriptor:
        raise NotImplementedError

    @abstractmethod
    def extract_representative_slab_for_medgemma(
        self,
        raw_bytes: bytes,
        start_slice: int,
        end_slice: int,
        max_slices: int = 8,
        window_center: float = 40.0,
        window_width: float = 400.0,
    ) -> SampledVolumetricSlab:
        """
        Uniformly samples up to `max_slices` (8 * 256 = 2,048 image tokens) across the
        target anatomical slab and applies windowing + 896x896 letterbox normalization.
        """
        raise NotImplementedError
