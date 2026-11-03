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

