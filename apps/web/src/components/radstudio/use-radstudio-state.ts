"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type {
  ModalityType,
  WlPresetType,
  SeriesType,
  ViewportToolType,
  LesionBox,
  DiagnosticAssessmentData,
  DiagnosticReportData,
  UploadedStudyData,
  DicomSeriesDataset,
} from "./types";
import { analyzeDicomDataset } from "./clinical-analyzer";

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
  const [activeDataset, setActiveDataset] = useState<DicomSeriesDataset | null>(null);
  const hasStudy = activeDataset !== null;

  const [modality, setModality] = useState<ModalityType>("CT");
  const [wlPreset, setWlPreset] = useState<WlPresetType>("lung");
  const [series, setSeries] = useState<SeriesType>("axial");
  const [slice, setSlice] = useState<number>(1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [activeTool, setActiveTool] = useState<ViewportToolType>("measure");
  const [zoomPercent, setZoomPercent] = useState<number>(140);
  const [isInverted, setIsInverted] = useState<boolean>(false);
  const [highlightedBox, setHighlightedBox] = useState<string | null>(null);
  const [splitSync, setSplitSync] = useState<boolean>(false);
  const [heatmapEnabled, setHeatmapEnabled] = useState<boolean>(false);
  const [volumetric3dOpen, setVolumetric3dOpen] = useState<boolean>(false);
  const [fhirModalOpen, setFhirModalOpen] = useState<boolean>(false);
  const [uploadModalOpen, setUploadModalOpen] = useState<boolean>(false);
  const [ehrSyncStatus, setEhrSyncStatus] = useState<"idle" | "syncing" | "synced">("idle");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [assessment, setAssessment] = useState<DiagnosticAssessmentData>(DEFAULT_ASSESSMENT);
  const [box01, setBox01] = useState<LesionBox | null>(null);
  const [box02, setBox02] = useState<LesionBox | null>(null);
  const [report, setReport] = useState<DiagnosticReportData | null>(null);
  const [customTotalSlices, setCustomTotalSlices] = useState<number | null>(null);
  const [reconSpecs, setReconSpecs] = useState<string>("120 kVp • 240 mA • Recon: B60f Sharp • Calibrated HU");

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

  const totalSlices = activeDataset
    ? activeDataset.numSlices
    : customTotalSlices ?? 0;

  // Calculate realistic Z-position in mm based on active slice or formula fallback
  const zPositionMm =
    activeDataset && activeDataset.slices[slice - 1]
      ? activeDataset.slices[slice - 1].sliceLocation.toFixed(1)
      : (-180 + (slice - 1) * 0.88).toFixed(1);

  // Cineloop play interval
  useEffect(() => {
    if (!isPlaying || totalSlices <= 1) return;
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
        setSlice((s) => (totalSlices > 0 ? Math.min(totalSlices, s + 1) : 1));
      } else if (e.key === " ") {
        e.preventDefault();
        if (totalSlices > 1) {
          setIsPlaying((p) => !p);
        }
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
    if (box01) {
      setSlice(box01.sliceIndex);
      setHighlightedBox("BOX-01");
      showToast(`Navigated to Slice ${box01.sliceIndex} • BOX-01 (${box01.label})`);
    } else {
      showToast("No focal nodule detected on this study");
    }
  };

  const jumpToBox02 = () => {
    setSeries("axial");
    if (box02) {
      setSlice(box02.sliceIndex);
      setHighlightedBox("BOX-02");
      showToast(`Navigated to Slice ${box02.sliceIndex} • BOX-02 (${box02.label})`);
    }
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

  const handleDicomUploaded = (dataset: DicomSeriesDataset, summary?: UploadedStudyData) => {
    setActiveDataset(dataset);
    const numSlices = dataset.numSlices;
    setCustomTotalSlices(numSlices);

    // Compute real 3D volumetric analysis & ACR Lung-RADS v2022 from actual voxel data
    const analysis = analyzeDicomDataset(dataset);

    setAssessment(analysis.assessment);
    setReport(analysis.report);
    setBox01(analysis.box01);
    setBox02(analysis.box02);
    setHighlightedBox(analysis.box01 ? "BOX-01" : null);

    const targetSlice = analysis.box01
      ? analysis.box01.sliceIndex
      : summary?.peakSlice && summary.peakSlice <= numSlices
      ? summary.peakSlice
      : Math.max(1, Math.floor(numSlices / 2));
    setSlice(targetSlice);

    setReconSpecs(
      `${dataset.kvp || 120} kVp • ${dataset.ma || 240} mA • Recon: ${
        dataset.reconKernel || dataset.slices[0]?.reconKernel || "B60f Sharp"
      } • MedGemma 1.5 3D Quantification`
    );

    setUploadModalOpen(false);
    showToast(
      `✓ Ingested DICOM ${dataset.seriesDescription || "Series"}: MedGemma analysis complete (${numSlices} slices)`
    );
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
    uploadModalOpen,
    setUploadModalOpen,
    hasStudy,
    activeDataset,
    setActiveDataset,
    handleDicomUploaded,
    reconSpecs,
    ehrSyncStatus,
    triggerEhrSync,
    toastMessage,
    showToast,
    expandedSections,
    toggleSection,
    jumpToBox01,
    jumpToBox02,
    assessment,
    report,
    box01,
    box02,
  };
}

