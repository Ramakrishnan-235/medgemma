"use client";

import { useShallow } from "zustand/react/shallow";

import React, { useState } from "react";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { Heading, ContextBar, Badge, SourceChip } from "../CommonUI";
import { Icon } from "../Icons";
import { Viewer } from "../Viewer";
import { ScanSVG } from "../ScanSVG";

export function ImagingScreen() {
  const { imagingMode, setImagingMode, selectedSeries, setSelectedSeries, setPage, showToast } = useWorkspaceStore(
    useShallow((state) => ({
      imagingMode: state.imagingMode,
      setImagingMode: state.setImagingMode,
      selectedSeries: state.selectedSeries,
      setSelectedSeries: state.setSelectedSeries,
      setPage: state.setPage,
      showToast: state.showToast,
    })),
  );

  const [reviewerNote, setReviewerNote] = useState("");

  const handleSeriesClick = (sId: string) => {
    setSelectedSeries(sId);
    showToast("Series selected. The preview keeps the same schematic illustration.");
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
        <span className="muted small">CT chest · Series {selectedSeries}</span>
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
              <Badge text="Schematic" />
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
                  <span className="scan-label">{name} · Layout placeholder</span>
                  <ScanSVG type={m} />
                </div>
              ))}
            </div>
            <div className="viewerbottom">
              Volume rendering and orientation controls · Design only
            </div>
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
            <Badge text="Draft" variant="soft" />
          </div>

          <div className="finding">
            <strong>
              {imagingMode === "localization"
                ? "Right upper lobe"
                : "Source-linked observations"}
            </strong>
            <p>
              {imagingMode === "localization"
                ? "Selecting a region links its annotation to the corresponding image and source. The overlay here is schematic."
                : "Model observations would be listed here with a linked study, series and slice. This concept does not analyze the illustration."}
            </p>
            <SourceChip label="Series 01 · Slice 124" />
          </div>

          <div className="finding">
            <strong>Context to review</strong>
            <p>
              Compare with the prior study and confirm the acquisition context
              before interpreting change.
            </p>
            <SourceChip label="Prior study · 21 Jul" />
          </div>

          <div className="finding">
            <strong>Reviewer note</strong>
            <textarea
              className="forminput"
              aria-label="Imaging reviewer note"
              placeholder="Add your observation..."
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
        <span>↔ Compare linked studies</span>
        <span>⊕ Select a region to inspect evidence</span>
      </div>
    </>
  );
}
