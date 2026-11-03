"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  DiagnosticModality,
  HistogramBarData,
  SlabMode,
  WindowPreset,
} from "./types";
import {
  downloadSegmentationManifest,
  fetchClusterStatus,
  fetchVolumetricAnalysis,
  generateLocalHistogram,
} from "./api";

export function useVolumetricState() {
  const [modality, setModality] = useState<DiagnosticModality>("3d_mri");
  const [axialSlice, setAxialSlice] = useState(64);
  const [coronalSlice, setCoronalSlice] = useState(82);
  const [sagittalSlice, setSagittalSlice] = useState(51);
  const [syncLocked, setSyncLocked] = useState(true);
  const [crosshairX, setCrosshairX] = useState(0.38);
  const [crosshairY, setCrosshairY] = useState(0.42);

  // 3D Slab rotation
  const [azimuth, setAzimuth] = useState(-18);
  const [elevation, setElevation] = useState(34);
  const [autoOrbit, setAutoOrbit] = useState(true);

  // Slab modes
  const slabModes: SlabMode[] = ["15mm mip", "4k mip", "Surface slab"];
  const [slabModeIndex, setSlabModeIndex] = useState(0);
  const currentSlabMode = slabModes[slabModeIndex];

  // Window/Sequence preset
  const [wlPreset, setWlPreset] = useState<WindowPreset>("t2_weighted");

  // Modals & toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [citationModalOpen, setCitationModalOpen] = useState(false);
  const [caseModalOpen, setCaseModalOpen] = useState(false);
  const [caseId, setCaseId] = useState("CASE-2026-0894");

  // Streaming reasoning state
  const [streamedReasoning, setStreamedReasoning] = useState("");
  const streamIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback((msg: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  }, []);

  // TanStack Query for cluster status
  const clusterQuery = useQuery({
    queryKey: ["cluster-status"],
    queryFn: fetchClusterStatus,
    refetchInterval: 15000,
  });

  // TanStack Query for volumetric analysis
  const analysisQuery = useQuery({
    queryKey: ["volumetric-analysis", modality, wlPreset, axialSlice, caseId],
    queryFn: () =>
      fetchVolumetricAnalysis({
        modality,
        sequencePreset: wlPreset,
        activeSlice: axialSlice,
        caseId,
      }),
  });

  const analysisData = analysisQuery.data;

  // Stream reasoning effect
  const startReasoningStream = useCallback((fullText: string) => {
    if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
    setStreamedReasoning("");
    const words = fullText.split(" ");
    let i = 0;
    streamIntervalRef.current = setInterval(() => {
      if (i < words.length) {
        setStreamedReasoning((prev) => (i === 0 ? words[0] : `${prev} ${words[i]}`));
        i++;
      } else {
        if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
      }
    }, 30);
  }, []);

  useEffect(() => {
    if (!analysisData?.reasoning_trace) return;
    const timeout = setTimeout(() => {
      startReasoningStream(analysisData.reasoning_trace);
    }, 0);
    return () => clearTimeout(timeout);
  }, [analysisData?.reasoning_trace, startReasoningStream]);

  // Synchronized slice setter
  const setSlicePosition = useCallback(
    (newSlice: number) => {
      const clamped = Math.min(160, Math.max(1, Math.round(newSlice)));
      setAxialSlice(clamped);

      if (syncLocked) {
        setCoronalSlice(Math.min(160, Math.max(1, Math.round(82 + (clamped - 64) * 0.45))));
        setSagittalSlice(Math.min(160, Math.max(1, Math.round(51 + (clamped - 64) * 0.35))));
      }
    },
    [syncLocked]
  );

  // Jump to ROIs
  const jumpToRoi1 = useCallback(() => {
    setCrosshairX(0.38);
    setCrosshairY(0.42);
    setSlicePosition(64);
    const targetLabel = modality === "3d_mri" ? "[MRI-ROI-01]" : "[CT-ROI-01]";
    showToast(`Centered viewports on ${targetLabel} at axial slice 64`);
  }, [modality, setSlicePosition, showToast]);

  const jumpToRoi2 = useCallback(() => {
    setCrosshairX(0.56);
    setCrosshairY(0.58);
    setSlicePosition(112);
    const targetLabel = modality === "3d_mri" ? "[MRI-ROI-02]" : "[CT-ROI-02]";
    showToast(`Centered viewports on ${targetLabel} at axial slice 112`);
  }, [modality, setSlicePosition, showToast]);

  // Export NIfTI / DICOM-SEG
  const handleExportNifti = useCallback(async () => {
    showToast("Generating 3D NIfTI / DICOM-SEG bundle...");
    const blob = await downloadSegmentationManifest(caseId, modality, axialSlice);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${modality === "3d_mri" ? "MRI" : "CT"}_segmentation_manifest_${caseId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Downloaded segmentation metadata bundle");
  }, [axialSlice, caseId, modality, showToast]);

  // Histogram data
  const histogramBars: HistogramBarData[] = useMemo(() => {
    if (analysisData?.z_attention_scores && analysisData.z_attention_scores.length > 0) {
      return analysisData.z_attention_scores;
    }
    return generateLocalHistogram(160);
  }, [analysisData?.z_attention_scores]);

  // Local mean HU / MRI Signal calculation
  const currentHuOrSignal = useMemo(() => {
    const dist64 = Math.abs(axialSlice - 64);
    const dist112 = Math.abs(axialSlice - 112);
    if (modality === "3d_mri") {
      if (dist64 <= 6) return "T2 Hyperintense (ADC 0.82)";
      if (dist112 <= 5) return "FLAIR High Signal";
      return "Isointense (parenchyma)";
    } else {
      if (dist64 <= 6) return `${42 + Math.round(dist64 * 1.5)} HU (lesion)`;
      if (dist112 <= 5) return `${-320 + dist112 * 12} HU (atelectasis)`;
      return `${58 + Math.round(Math.sin(axialSlice * 0.2) * 4)} HU (mean)`;
    }
  }, [axialSlice, modality]);

  const activeAttentionText = useMemo(() => {
    const dist64 = Math.abs(axialSlice - 64);
    const dist112 = Math.abs(axialSlice - 112);
    const roiTag = modality === "3d_mri" ? "MRI-ROI" : "CT-ROI";
    if (dist64 <= 6) {
      const conf = (96.4 - dist64 * 1.4).toFixed(1);
      return `Slice ${axialSlice} (${conf}% conf | [${roiTag}-01] segment VII)`;
    }
    if (dist112 <= 5) {
      const conf = (88.2 - dist112 * 1.8).toFixed(1);
      return `Slice ${axialSlice} (${conf}% conf | [${roiTag}-02] secondary)`;
    }
    return `Slice ${axialSlice} (baseline parenchyma • ${currentHuOrSignal})`;
  }, [axialSlice, currentHuOrSignal, modality]);

  return {
    modality,
    setModality,
    axialSlice,
    coronalSlice,
    sagittalSlice,
    syncLocked,
    setSyncLocked,
    crosshairX,
    setCrosshairX,
    crosshairY,
    setCrosshairY,
    azimuth,
    setAzimuth,
    elevation,
    setElevation,
    autoOrbit,
    setAutoOrbit,
    currentSlabMode,
    cycleSlabMode: () => {
      const nextIdx = (slabModeIndex + 1) % slabModes.length;
      setSlabModeIndex(nextIdx);
      showToast(`3d slab mode set to ${slabModes[nextIdx]}`);
    },
    wlPreset,
    setWlPreset,
    setSlicePosition,
    jumpToRoi1,
    jumpToRoi2,
    handleExportNifti,
    clusterStatus: clusterQuery.data,
    analysisData,
    streamedReasoning,
    reStreamReasoning: () => {
      if (analysisData?.reasoning_trace) {
        startReasoningStream(analysisData.reasoning_trace);
        showToast("Re-streaming MedGemma 1.5 reasoning trace");
      }
    },
    toastMessage,
    showToast,
    citationModalOpen,
    setCitationModalOpen,
    caseModalOpen,
    setCaseModalOpen,
    caseId,
    setCaseId,
    histogramBars,
    currentHuOrSignal,
    activeAttentionText,
  };
}

