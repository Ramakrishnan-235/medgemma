import { create } from "zustand";

export type ViewerToolMode = "WindowLevel" | "Pan" | "Zoom" | "DrawBox";

export interface NormalizedBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface StudyAnnotation {
  id: string;
  source_file_id?: string;
  frame_index?: number;
  origin: "manual" | "model_medgemma";
  anatomical_label: string;
  finding_text?: string | null;
  bbox_norm: NormalizedBox;
  review_state: "pending_review" | "accepted" | "rejected";
}

interface ImagingWorkspaceState {
  activeTool: ViewerToolMode;
  syncPriorCurrent: boolean;
  showModelBoxes: boolean; // Client toggle for FEATURE_MODEL_LOCALIZATION_BOXES
  sharedWindowRange: { lower: number; upper: number } | null;
  highlightedSourceId: string | null;
  highlightedBboxNorm: NormalizedBox | null;
  setActiveTool: (tool: ViewerToolMode) => void;
  setSyncPriorCurrent: (sync: boolean) => void;
  setShowModelBoxes: (show: boolean) => void;
  setSharedWindowRange: (range: { lower: number; upper: number } | null) => void;
  focusCitationOnViewer: (sourceId: string, bboxNorm: NormalizedBox | null) => void;
}

export const useImagingStore = create<ImagingWorkspaceState>((set) => ({
  activeTool: "WindowLevel",
  syncPriorCurrent: true,
  showModelBoxes: false,
  sharedWindowRange: null,
  highlightedSourceId: null,
  highlightedBboxNorm: null,
  setActiveTool: (activeTool: ViewerToolMode) => set({ activeTool }),
  setSyncPriorCurrent: (syncPriorCurrent: boolean) => set({ syncPriorCurrent }),
  setShowModelBoxes: (showModelBoxes: boolean) => set({ showModelBoxes }),
  setSharedWindowRange: (sharedWindowRange: { lower: number; upper: number } | null) =>
    set({ sharedWindowRange }),
  focusCitationOnViewer: (
    highlightedSourceId: string,
    highlightedBboxNorm: NormalizedBox | null
  ) => set({ highlightedSourceId, highlightedBboxNorm }),
}));
