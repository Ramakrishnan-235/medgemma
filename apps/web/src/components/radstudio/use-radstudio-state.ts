"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type {
  ModalityType,
  WlPresetType,
  SeriesType,
  ViewportToolType,
  LesionBox,
  DiagnosticAssessmentData,
} from "./types";

export const DEFAULT_ASSESSMENT: DiagnosticAssessmentData = {
  accessionNumber: "ACC-89432",
  protocol: "LUNG-HRCT",
  lungRadsCurrent: "Lung-RADS 4B: High Suspicion",
  lungRadsPrior: "Prior 2024: Lung-RADS 3",
  priorYear: 2024,
  nodesStatus: "Nodes: Benign",
  malignancyProbability: 84.2,
  thresholdIntervention: 65,
  aucScore: 0.941,
  volumeCm3: 0.42,
  densityHu: 45,
  max2dMm: 14.2,
  site: "RUL Apical",
  vdtDays: 118,
  riskExpansionLabel: "High Risk Expansion",
  fhirReady: true,
};

export const BOX_01: LesionBox = {
  id: "BOX-01",
  label: "RUL Spiculated Nodule",
  sliceIndex: 42,
  diameterMm: 14.2,
  coordinates: [0.38, 0.62, 0.49],
  huAttenuation: 45,
  volumeCm3: 0.42,
  vdtDays: 118,
  site: "Right Upper Lobe Apical",
  riskCategory: "Lung-RADS 4B",
};

export const BOX_02: LesionBox = {
  id: "BOX-02",
  label: "LLL Subpleural Nodule",
  sliceIndex: 65,
  diameterMm: 6.5,
  coordinates: [0.65, 0.28, 0.52],
  huAttenuation: 22,
  volumeCm3: 0.11,
  vdtDays: 450,
  site: "Left Lower Lobe Subpleural",
  riskCategory: "Lung-RADS 3 (Stable)",
};

export function useRadStudioState() {
  const [modality, setModality] = useState<ModalityType>("CT");
  const [wlPreset, setWlPreset] = useState<WlPresetType>("lung");
  const [series, setSeries] = useState<SeriesType>("axial");
  const [slice, setSlice] = useState<number>(42);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [activeTool, setActiveTool] = useState<ViewportToolType>("measure");
  const [zoomPercent, setZoomPercent] = useState<number>(140);
  const [isInverted, setIsInverted] = useState<boolean>(false);
  const [highlightedBox, setHighlightedBox] = useState<string | null>("BOX-01");
  const [splitSync, setSplitSync] = useState<boolean>(false);
  const [heatmapEnabled, setHeatmapEnabled] = useState<boolean>(false);
  const [volumetric3dOpen, setVolumetric3dOpen] = useState<boolean>(false);
  const [fhirModalOpen, setFhirModalOpen] = useState<boolean>(false);
  const [ehrSyncStatus, setEhrSyncStatus] = useState<"idle" | "syncing" | "synced">("idle");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [expandedSections, setExpandedSections] = useState({
    lungs: true,
    mediastinum: false,
    pleura: false,
  });

  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback((msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage(msg);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  }, []);

  const totalSlices = series === "axial" ? 128 : series === "coronal" ? 86 : series === "sagittal" ? 54 : 100;

  // Calculate realistic Z-position in mm based on slice
  const zPositionMm = (-180 + (slice - 1) * 0.88).toFixed(1);

  // Cineloop play interval
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setSlice((prev) => (prev >= totalSlices ? 1 : prev + 1));
    }, 110);
    return () => clearInterval(interval);
  }, [isPlaying, totalSlices]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setSlice((s) => Math.max(1, s - 1));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setSlice((s) => Math.min(totalSlices, s + 1));
      } else if (e.key === " ") {
        e.preventDefault();
        setIsPlaying((p) => !p);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [totalSlices]);

  const toggleSection = (section: "lungs" | "mediastinum" | "pleura") => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const jumpToBox01 = () => {
    setSeries("axial");
    setSlice(42);
    setHighlightedBox("BOX-01");
    showToast("Navigated to Slice 42 • BOX-01 (RUL Spiculated Nodule)");
  };

  const jumpToBox02 = () => {
    setSeries("axial");
    setSlice(65);
    setHighlightedBox("BOX-02");
    showToast("Navigated to Slice 65 • BOX-02 (LLL Subpleural Nodule)");
  };

  const triggerEhrSync = () => {
    if (ehrSyncStatus === "syncing") return;
    setEhrSyncStatus("syncing");
    showToast("Synchronizing DiagnosticReport with EHR HL7/FHIR v4 endpoint...");

    setTimeout(() => {
      setEhrSyncStatus("synced");
      showToast("✓ Successfully synced DiagnosticReport to Epic/Cerner FHIR Gateway");
      setTimeout(() => {
        setEhrSyncStatus("idle");
      }, 4000);
    }, 1800);
  };

  return {
    modality,
    setModality,
    wlPreset,
    setWlPreset,
    series,
    setSeries,
    slice,
    setSlice,
    totalSlices,
    zPositionMm,
    isPlaying,
    setIsPlaying,
    activeTool,
    setActiveTool,
    zoomPercent,
    setZoomPercent,
    isInverted,
    setIsInverted,
    highlightedBox,
    setHighlightedBox,
    splitSync,
    setSplitSync,
    heatmapEnabled,
    setHeatmapEnabled,
    volumetric3dOpen,
    setVolumetric3dOpen,
    fhirModalOpen,
    setFhirModalOpen,
    ehrSyncStatus,
    triggerEhrSync,
    toastMessage,
    showToast,
    expandedSections,
    toggleSection,
    jumpToBox01,
    jumpToBox02,
    assessment: DEFAULT_ASSESSMENT,
    box01: BOX_01,
    box02: BOX_02,
  };
}

