export type ModalityType = "CT" | "MRI" | "WSI";

export type WlPresetType = "lung" | "bone" | "mediastinal" | "brain";

export type SeriesType = "axial" | "coronal" | "sagittal" | "mip";

export type ViewportToolType =
  | "pan"
  | "zoom"
  | "measure"
  | "crosshair"
  | "box"
  | "invert";

export interface SeriesItem {
  id: SeriesType;
  title: string;
  slicesCount: number;
  tag: string;
  specs: string;
  description: string;
  thickness: string;
}

export interface LesionBox {
  id: string;
  label: string;
  sliceIndex: number;
  diameterMm: number;
  coordinates: [number, number, number]; // [x, y, z] normalized
  box_2d_1000?: [number, number, number, number]; // MedGemma [ymin, xmin, ymax, xmax] (0-1000)
  huAttenuation: number;
  volumeCm3: number;
  vdtDays: number;
  site: string;
  riskCategory: string;
  isAiGenerated?: boolean;
  provenance?: "neural_medgemma" | "heuristic_voxel" | "mock_fallback";
}

export interface DiagnosticAssessmentData {
  accessionNumber: string;
  protocol: string;
  lungRadsCurrent: string;
  lungRadsPrior: string;
  priorYear: number;
  nodesStatus: string;
  malignancyProbability: number;
  thresholdIntervention: number;
  aucScore: number;
  volumeCm3: number;
  densityHu: number;
  max2dMm: number;
  site: string;
  vdtDays: number;
  riskExpansionLabel: string;
  fhirReady: boolean;
}

export interface UploadedStudyData {
  fileName: string;
  fileCount: number;
  accessionNumber: string;
  protocol: string;
  numSlices: number;
  sliceThicknessMm: number;
  kvp: number;
  ma: number;
  reconKernel: string;
  lungRads: string;
  malignancyProb: number;
  primaryNoduleMm: number;
  peakSlice: number;
  volumeCm3: number;
  meanHu: number;
  vdtDays: number;
  site: string;
  box01?: LesionBox | null;
  box02?: LesionBox | null;
}

export interface DicomSlice {
  sliceIndex: number; // 1-based (1..numSlices)
  instanceNumber: number;
  sliceLocation: number; // Z-coordinate in mm
  rows: number;
  cols: number;
  pixelData: Int16Array | Uint16Array;
  rescaleSlope: number;
  rescaleIntercept: number;
  windowCenter: number;
  windowWidth: number;
  pixelSpacing?: [number, number];
  sliceThickness?: number;
  sopInstanceUid: string;
  seriesInstanceUid?: string;
  studyInstanceUid?: string;
  modality?: string;
  seriesDescription?: string;
  reconKernel?: string;
  patientName?: string;
}

export interface DiagnosticReportData {
  accessionNumber?: string;
  lungsFinding: string;
  mediastinumFinding: string;
  pleuraFinding: string;
  impressions: string[];
  recommendation: string;
  hasNodule: boolean;
  narrativeMarkdown?: string;
  noduleDetails?: {
    sliceIndex: number;
    diameterMm: number;
    volumeCm3: number;
    meanHu: number;
    site: string;
  };
}

export interface DicomSeriesDataset {
  seriesInstanceUid: string;
  seriesDescription: string;
  modality: string;
  numSlices: number;
  slices: DicomSlice[]; // Sorted ascending by sliceLocation
  reconKernel?: string;
  patientName?: string;
  studyInstanceUid?: string;
  kvp?: number;
  ma?: number;
  accessionNumber?: string;
}


