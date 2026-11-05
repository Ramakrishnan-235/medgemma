export type DiagnosticModality = "3d_mri" | "3d_ct" | "wsi";

export type WindowPreset =
  | "t2_weighted"
  | "t1_weighted"
  | "flair"
  | "dwi_adc"
  | "t1_contrast"
  | "soft_tissue"
  | "liver_dome"
  | "lung"
  | "bone";

export type SlabMode = "15mm mip" | "4k mip" | "Surface slab";

export interface HistogramBarData {
  slice: number;
  score: number;
  isPeak: boolean;
}

export interface RoiData {
  id: string;
  label: string;
  location: string;
  dimensionsStr: string;
  volumeCm3: number;
  attenuationOrIntensity: string;
  meanHu: number;
  confidencePercent: number;
  clinicalStatus: string;
  reconstructionSpan?: string;
}

export interface SecondaryRoiData {
  id: string;
  label: string;
  location: string;
  confidencePercent: number;
  clinicalStatus: string;
}

export interface ScannerTelemetry {
  matrix: string;
  field_strength?: string;
  sequence?: string;
  kvp?: number;
  kernel?: string;
  slice_thickness_mm: number;
  fov_mm: number;
  coil?: string;
  b_values?: string;
  spiral_pitch?: number;
  dlp_mgy_cm?: number;
}

export interface VolumetricAnalysisPayload {
  case_id: string;
  modality: DiagnosticModality;
  sequence_preset: string;
  active_slice: number;
  total_slices: number;
  scanner_telemetry: ScannerTelemetry;
  primary_roi: RoiData;
  secondary_rois: SecondaryRoiData[];
  z_attention_scores: HistogramBarData[];
  sampled_slices_count: number;
  sampled_slices: number[];
  reasoning_trace: string;
  status: string;
  pipeline_latency_sec: number;
  is_live_backend?: boolean;
}

export interface ClusterStatus {
  status: string;
  service: string;
  cluster_online_percent: number;
  sampled_slices_count: number;
  token_context_window: string;
  vllm_engine: string;
  precision: string;
  is_live_backend?: boolean;
}

export interface NormalizedBox1000 {
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
}

export interface PixelBoundingBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface VisualGroundingAnnotation {
  id: string;
  slice_index: number;
  label: string;
  confidence: number;
  box_1000: NormalizedBox1000;
  anatomical_region: string;
  finding_type: string;
  mean_hu?: number;
  dimensions_mm?: string;
}

export interface TargetedSliceVQARequest {
  case_id?: string;
  slice_index: number;
  tissue_window: WindowPreset;
  question: string;
}

export interface TargetedSliceVQAResponse {
  slice_index: number;
  question: string;
  answer_markdown: string;
  confidence_score: number;
  grounded_box?: NormalizedBox1000 | null;
  relevant_anatomical_regions?: string[];
}

export interface DAGPipelineResponse {
  status: string;
  study_id: string;
  slices_processed: number;
  token_budget: number;
  output_b_lung_rads: {
    lung_rads_category: string;
    malignancy_risk_score: number;
    primary_findings: string[];
    recommended_follow_up: string;
  };
  output_d_detections: Array<{
    slice_index: number;
    label: string;
    box_2d: [number, number, number, number];
    physical_size?: {
      width_mm: number;
      height_mm: number;
      mean_diameter_mm: number;
    };
    z_coord_mm?: number;
    monai_3d_volume?: {
      volume_mm3: number;
      volume_cm3: number;
      voxel_count: number;
      mean_hu: number;
      method: string;
    };
  }>;
  output_a_narrative_report: string;
  spatial_meta: {
    pixel_spacing_mm: [number, number];
    original_shape: [number, number];
    slice_thickness_mm: number;
    slice_z_mm: number[];
  };
}


