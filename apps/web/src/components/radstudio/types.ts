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
  huAttenuation: number;
  volumeCm3: number;
  vdtDays: number;
  site: string;
  riskCategory: string;
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

