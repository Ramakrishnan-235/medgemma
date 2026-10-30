"use client";

import { useShallow } from "zustand/react/shallow";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { Heading, ContextBar, Badge, SourceChip } from "../CommonUI";
import { Icon } from "../Icons";
import { Viewer } from "../Viewer";
import { ScanSVG } from "../ScanSVG";
import { api } from "@/lib/api";
import type { StudyAnnotation } from "@/stores/useImagingStore";

const ChestXrayViewport = dynamic(() => import("@/components/viewer/ChestXrayViewport"), {
  ssr: false,
  loading: () => (
    <div className="viewer" style={{ minHeight: "560px", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="viewerbar">
        <span>Initializing Cornerstone3D Viewport (WebGL / WASM)...</span>
      </div>
    </div>
  ),
});

export function ImagingScreen() {
  const { imagingMode, setImagingMode, selectedSeries, setSelectedSeries, setPage, showToast, activeCaseId } = useWorkspaceStore(
    useShallow((state) => ({
      imagingMode: state.imagingMode,
      setImagingMode: state.setImagingMode,
      selectedSeries: state.selectedSeries,
      setSelectedSeries: state.setSelectedSeries,
      setPage: state.setPage,
      showToast: state.showToast,
      activeCaseId: state.activeCaseId,
    })),
  );

  const [reviewerNote, setReviewerNote] = useState("");
  const [viewportEngine, setViewportEngine] = useState<"cornerstone" | "schematic">("cornerstone");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [annotations, setAnnotations] = useState<StudyAnnotation[]>([
    {
      id: "ann-ai-01",
      source_file_id: "src-curr-01",
      frame_index: 1,
      origin: "model_medgemma",
      anatomical_label: "Right Lower Lobe Consolidation",
      finding_text: "Focal airspace opacification with air bronchograms",
      bbox_norm: { x0: 0.52, y0: 0.58, x1: 0.76, y1: 0.82 },
      review_state: "accepted",
    },
  ]);

  const handleSeriesClick = (sId: string) => {
    setSelectedSeries(sId);
    showToast(`Series ${sId} selected.`);
  };

  const handleCreateManualAnnotation = async (
    bbox: { x0: number; y0: number; x1: number; y1: number },
    label: string
  ) => {
    try {
      const created = await api.createAnnotation(activeCaseId, {
        source_file_id: "src-curr-01",
        anatomical_label: label,
        bbox_norm: bbox,
        finding_text: reviewerNote || "Clinician manual ROI box",
      });
      setAnnotations((prev) => [...prev, created]);
      showToast(`Saved manual ROI annotation '${label}' to PostgreSQL.`);
    } catch {
      const newAnn: StudyAnnotation = {
        id: `ann-local-${Date.now()}`,
        source_file_id: "src-curr-01",
        frame_index: 1,
        origin: "manual",
        anatomical_label: label,
        finding_text: reviewerNote,
        bbox_norm: bbox,
        review_state: "accepted",
      };
      setAnnotations((prev) => [...prev, newAnn]);
      showToast(`Added manual annotation '${label}' (Local preview).`);
    }
  };

  const handleRunMedGemmaAI = async () => {
    setIsAnalyzing(true);
    try {
      const run = await api.triggerSingleXrayAnalysis(activeCaseId, "src-curr-01");
      showToast(`Queued MedGemma 1.5 single X-ray analysis (Run ID: ${run.run_id.slice(0, 8)}).`);
    } catch (err) {
      showToast(`Inference note: ${(err as Error).message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <>
      <Heading
        eyebrow="MEDICAL IMAGING"
        title="Look closer. See the context."
        desc="One workspace for images, anatomy and evidence."
        actions={
          <>
            <button
              type="button"
              className="btn"
              disabled={isAnalyzing}
              onClick={handleRunMedGemmaAI}
            >
              <Icon name="scan" /> {isAnalyzing ? "Analyzing..." : "MedGemma AI"}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => setPage("compare")}
            >
              <Icon name="compare" /> Compare
            </button>
            <button
              type="button"
              className="btn black"
              onClick={() => setPage("report")}
            >
              <Icon name="report" /> Generate draft
            </button>
          </>
        }
      />

      <ContextBar />

      {/* Mode Switcher Tabs */}
      <div className="toolbar viewtabs">
        <div className="tabs" aria-label="Imaging workspace mode">
          {[
            ["analysis", "Analysis"],
            ["volume", "3D & multiplanar"],
            ["localization", "Anatomical localization"],
          ].map(([id, t]) => (
            <button
              key={id}
              type="button"
              className={imagingMode === id ? "selected" : ""}
              onClick={() =>
                setImagingMode(id as "analysis" | "volume" | "localization")
              }
            >
              {t}
            </button>
          ))}
        </div>

        <div className="row" style={{ gap: "8px" }}>
          <button
            type="button"
            className={`btn small ${viewportEngine === "cornerstone" ? "black" : ""}`}
            onClick={() => setViewportEngine(viewportEngine === "cornerstone" ? "schematic" : "cornerstone")}
          >
            {viewportEngine === "cornerstone" ? "Cornerstone3D Active" : "Schematic View"}
          </button>
          <span className="muted small">CT chest · Series {selectedSeries}</span>
        </div>
      </div>

      {/* Main Study Layout */}
      <div className="study-layout">
        {/* Left Series Selector */}
        <aside className="series">
          <small className="muted">SERIES</small>
          <button
            type="button"
            className={selectedSeries === "01" ? "selected" : ""}
            onClick={() => handleSeriesClick("01")}
          >
            <Icon name="scan" />
            01 <small>Axial</small>
          </button>
          <button
            type="button"
            className={selectedSeries === "02" ? "selected" : ""}
            onClick={() => handleSeriesClick("02")}
          >
            <Icon name="scan" />
            02 <small>Coronal</small>
          </button>
          <button
            type="button"
            className={selectedSeries === "03" ? "selected" : ""}
            onClick={() => handleSeriesClick("03")}
          >
            <Icon name="scan" />
            03 <small>Sagittal</small>
          </button>
        </aside>

        {/* Center Viewport */}
        {imagingMode === "volume" ? (
          <div className="viewer">
            <div className="viewerbar">
              <span>3D & MULTIPLANAR WORKSPACE</span>
              <Badge text="Volumetric" />
            </div>
            <div className="volume-grid">
              {(
                [
                  ["Axial", "axial"],
                  ["Coronal", "axial"],
                  ["Sagittal", "axial"],
                  ["Volume", "volume"],
                ] as [string, "axial" | "volume"][]
              ).map(([name, m]) => (
                <div key={name} className="scan">
                  <span className="scan-label">{name} · Multiplanar</span>
                  <ScanSVG type={m} />
                </div>
              ))}
            </div>
            <div className="viewerbottom">
              Multi-slice slab rendering · MPR view
            </div>
          </div>
        ) : viewportEngine === "cornerstone" ? (
          <div style={{ flex: 1, minHeight: "560px" }}>
            <ChestXrayViewport
              viewportId="imaging-main-viewport"
              sourceFileId="src-curr-01"
              studyTitle={`Chest Study Series ${selectedSeries}`}
              viewPosition="PA"
              imageUrl="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='896' height='896' viewBox='0 0 896 896'><rect width='896' height='896' fill='%23050505'/><ellipse cx='448' cy='448' rx='260' ry='340' fill='%23111827' stroke='%23374151' stroke-width='4'/><path d='M300 360 C320 280 400 270 420 360 C420 500 320 540 300 480 Z' fill='%231f2937'/><path d='M596 360 C576 280 496 270 476 360 C476 500 576 540 596 480 Z' fill='%231f2937'/><text x='448' y='80' fill='%239ca3af' font-size='20' text-anchor='middle'>CORNERSTONE3D 896x896 VIEWPORT</text></svg>"
              isDicom={false}
              imageWidth={896}
              imageHeight={896}
              annotations={annotations}
              onCreateManualBox={handleCreateManualAnnotation}
            />
          </div>
        ) : (
          <Viewer label={`CT CHEST / ${selectedSeries === "01" ? "AXIAL" : selectedSeries === "02" ? "CORONAL" : "SAGITTAL"}`} />
        )}

        {/* Right Observation & Findings Panel */}
        <aside className="panel findings">
          <div className="row between">
            <h3>
              {imagingMode === "localization"
                ? "Anatomical regions"
                : "Observation panel"}
            </h3>
            <Badge text="Live Grounding" variant="soft" />
          </div>

          <div className="finding">
            <strong>
              {imagingMode === "localization"
                ? "Right lower lobe"
                : "Source-linked observations"}
            </strong>
            <p>
              Consolidation identified with normalized coordinates [x0: 0.52, y0: 0.58, x1: 0.76, y1: 0.82].
            </p>
            <SourceChip label={`Series ${selectedSeries} · Frame 1`} />
          </div>

          <div className="finding">
            <strong>Active Annotations ({annotations.length})</strong>
            <div style={{ marginTop: "6px", display: "flex", flexDirection: "column", gap: "6px" }}>
              {annotations.map((ann) => (
                <div key={ann.id} className="row between" style={{ fontSize: "11px", padding: "4px 8px", background: "var(--soft)", border: "1px solid var(--line)", borderRadius: "4px" }}>
                  <span className="text-zinc-100">{ann.anatomical_label}</span>
                  <Badge text={ann.origin} variant={ann.origin === "model_medgemma" ? "soft" : "dash"} />
                </div>
              ))}
            </div>
          </div>

          <div className="finding">
            <strong>Reviewer note</strong>
            <textarea
              className="forminput"
              aria-label="Imaging reviewer note"
              placeholder="Add your observation or label for manual ROI box..."
              value={reviewerNote}
              onChange={(e) => setReviewerNote(e.target.value)}
              style={{
                marginTop: "6px",
                minHeight: "80px",
                resize: "vertical",
                fontSize: "11px",
              }}
            />
          </div>

          <button
            type="button"
            className="btn black w-full"
            onClick={() => setPage("report")}
          >
            Open report draft <Icon name="arrow" />
          </button>
        </aside>
      </div>

      <div className="mini-legend">
        <span>↔ Window/Level, Pan & Zoom tools enabled</span>
        <span>⊕ Click 'Box' tool to draw normalized ROI</span>
      </div>
    </>
  );
}
