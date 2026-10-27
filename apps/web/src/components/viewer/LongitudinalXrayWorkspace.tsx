"use client";

import { useShallow } from "zustand/react/shallow";

import React from "react";
import dynamic from "next/dynamic";
import { useImagingStore, type StudyAnnotation, type ViewerToolMode } from "@/stores/useImagingStore";

const ChestXrayViewport = dynamic(() => import("./ChestXrayViewport"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center w-full h-[460px] bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-500">
      Initializing Cornerstone3D WebGL Viewport...
    </div>
  ),
});

export interface StudyManifest {
  source_file_id: string;
  filename: string;
  file_kind: string;
  raw_dicom_or_image_url: string;
  normalized_display_png_url: string;
  metadata: {
    view_position?: string;
    encounter_date?: string | null;
    rows?: number;
    columns?: number;
  };
  annotations: StudyAnnotation[];
}

export interface LongitudinalXrayWorkspaceProps {
  priorStudy: StudyManifest;
  currentStudy: StudyManifest;
  featureModelBoxesEnabled: boolean;
  onTriggerLongitudinalRun: () => void;
}

export function LongitudinalXrayWorkspace({
  priorStudy,
  currentStudy,
  featureModelBoxesEnabled,
  onTriggerLongitudinalRun,
}: LongitudinalXrayWorkspaceProps) {
  const { activeTool, setActiveTool, syncPriorCurrent, setSyncPriorCurrent, showModelBoxes, setShowModelBoxes } = useImagingStore(
    useShallow((state) => ({
      activeTool: state.activeTool,
      setActiveTool: state.setActiveTool,
      syncPriorCurrent: state.syncPriorCurrent,
      setSyncPriorCurrent: state.setSyncPriorCurrent,
      showModelBoxes: state.showModelBoxes,
      setShowModelBoxes: state.setShowModelBoxes,
    })),
  );

  const tools: { id: ViewerToolMode; label: string }[] = [
    { id: "WindowLevel", label: "W/L Contrast" },
    { id: "Pan", label: "Pan" },
    { id: "Zoom", label: "Zoom" },
    { id: "DrawBox", label: "Annotate ROI" },
  ];

  const projectionMismatch =
    priorStudy.metadata.view_position &&
    currentStudy.metadata.view_position &&
    priorStudy.metadata.view_position !== currentStudy.metadata.view_position &&
    priorStudy.metadata.view_position !== "UNKNOWN" &&
    currentStudy.metadata.view_position !== "UNKNOWN";

  return (
    <div className="flex flex-col gap-3 w-full bg-zinc-950 text-zinc-100 p-4 rounded-xl border border-zinc-800">
      {/* Unified Viewer Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-zinc-800">
        <div className="flex items-center gap-1.5">
          {tools.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTool(t.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                activeTool === t.id
                  ? "bg-zinc-100 text-zinc-950"
                  : "bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4 text-xs">
          <label className="flex items-center gap-1.5 cursor-pointer text-zinc-300">
            <input
              type="checkbox"
              checked={syncPriorCurrent}
              onChange={(e) => setSyncPriorCurrent(e.target.checked)}
              className="rounded border-zinc-700 bg-zinc-900"
            />
            Sync Prior/Current W/L
          </label>

          {featureModelBoxesEnabled && (
            <label className="flex items-center gap-1.5 cursor-pointer text-amber-400">
              <input
                type="checkbox"
                checked={showModelBoxes}
                onChange={(e) => setShowModelBoxes(e.target.checked)}
                className="rounded border-zinc-700 bg-zinc-900"
              />
              Show MedGemma Boxes (Experimental)
            </label>
          )}

          <button
            onClick={onTriggerLongitudinalRun}
            className="px-3.5 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition"
          >
            Compare Interval Change (MedGemma 1.5)
          </button>
        </div>
      </div>

      {/* Automatic Projection Mismatch Banner */}
      {projectionMismatch && (
        <div className="px-3 py-2 rounded-md bg-amber-950/60 border border-amber-800/80 text-amber-200 text-xs">
          <strong>Projection Warning:</strong> Prior study is{" "}
          <span className="font-mono">{priorStudy.metadata.view_position}</span> while Current
          study is <span className="font-mono">{currentStudy.metadata.view_position}</span>.
          Evaluate apparent heart size and mediastinal width differences with caution.
        </div>
      )}

      {/* Side-by-Side Synchronized Viewports */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 min-h-[480px]">
        <ChestXrayViewport
          viewportId="vp_prior"
          sourceFileId={priorStudy.source_file_id}
          studyTitle={`PRIOR: ${priorStudy.filename}`}
          studyDate={priorStudy.metadata.encounter_date}
          viewPosition={priorStudy.metadata.view_position}
          imageUrl={priorStudy.normalized_display_png_url}
          isDicom={false}
          imageWidth={priorStudy.metadata.columns || 1024}
          imageHeight={priorStudy.metadata.rows || 1024}
          annotations={priorStudy.annotations}
        />

        <ChestXrayViewport
          viewportId="vp_current"
          sourceFileId={currentStudy.source_file_id}
          studyTitle={`CURRENT: ${currentStudy.filename}`}
          studyDate={currentStudy.metadata.encounter_date}
          viewPosition={currentStudy.metadata.view_position}
          imageUrl={currentStudy.normalized_display_png_url}
          isDicom={false}
          imageWidth={currentStudy.metadata.columns || 1024}
          imageHeight={currentStudy.metadata.rows || 1024}
          annotations={currentStudy.annotations}
        />
      </div>
    </div>
  );
}

export default LongitudinalXrayWorkspace;
