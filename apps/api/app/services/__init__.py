from app.services.dicom_xray_pipeline import (
    ChestXrayPreprocessor,
    LetterboxTransform,
    NormalizedXrayResult,
    apply_letterbox_896,
    compute_letterbox_transform,
    map_medgemma_box_to_source_norm,
)
from app.services.medgemma_adapter import (
    GroundedGenerationOutput,
    MedGemmaAdapter,
    VerifiedCitation,
)
from app.services.xray_analyzer import (
    ChestXrayAnalysisService,
    LongitudinalIntervalChange,
    LongitudinalXrayPayload,
    SingleXrayAnalysisPayload,
    XrayObservationSection,
)

from app.services.hybrid_retrieval import (
    RetrievalEvalMetrics,
    evaluate_retrieval_predictions,
    retrieve_case_evidence_hybrid_rrf,
)
from app.services.medgemma_service import DockerizedMedGemmaService
from app.services.volumetric_extension import (
    SampledVolumetricSlab,
    VolumetricModality,
    VolumetricSeriesAdapter,
    VolumetricSeriesDescriptor,
)
from app.services.ct_volume_pipeline import (
    generate_synthetic_3d_ct_volume,
    compute_3d_quantification,
    compute_z_axis_attention_scores,
    sample_sparse_attention_slices,
    window_to_rgb,
    main as run_ct_volume_pipeline,
)

__all__ = [
    "MedGemmaAdapter",
    "VerifiedCitation",
    "GroundedGenerationOutput",
    "ChestXrayPreprocessor",
    "LetterboxTransform",
    "NormalizedXrayResult",
    "compute_letterbox_transform",
    "apply_letterbox_896",
    "map_medgemma_box_to_source_norm",
    "ChestXrayAnalysisService",
    "SingleXrayAnalysisPayload",
    "LongitudinalXrayPayload",
    "XrayObservationSection",
    "LongitudinalIntervalChange",
    "retrieve_case_evidence_hybrid_rrf",
    "evaluate_retrieval_predictions",
    "RetrievalEvalMetrics",
    "DockerizedMedGemmaService",
    "VolumetricModality",
    "VolumetricSeriesDescriptor",
    "SampledVolumetricSlab",
    "VolumetricSeriesAdapter",
    "generate_synthetic_3d_ct_volume",
    "compute_3d_quantification",
    "compute_z_axis_attention_scores",
    "sample_sparse_attention_slices",
    "window_to_rgb",
    "run_ct_volume_pipeline",
]

