from pathlib import Path
from app.services.medgemma_service import DockerizedMedGemmaService
from app.services.ct_volume_pipeline import (
    generate_synthetic_3d_ct_volume,
    compute_3d_quantification,
    compute_z_axis_attention_scores,
    sample_sparse_attention_slices,
    window_to_rgb,
    main as run_ct_volume_pipeline,
)

_api_services = Path(__file__).resolve().parent.parent.parent / "apps" / "api" / "app" / "services"
if _api_services.exists() and str(_api_services) not in __path__:
    __path__.append(str(_api_services))

__all__ = [
    "DockerizedMedGemmaService",
    "generate_synthetic_3d_ct_volume",
    "compute_3d_quantification",
    "compute_z_axis_attention_scores",
    "sample_sparse_attention_slices",
    "window_to_rgb",
    "run_ct_volume_pipeline",
]
