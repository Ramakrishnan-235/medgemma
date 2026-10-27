"use client";

import { useShallow } from "zustand/react/shallow";

import React from "react";
import { ScanSVG } from "./ScanSVG";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

interface ViewerProps {
  label?: string;
  small?: boolean;
  mode?: "axial" | "volume";
  initialSlice?: number;
}

export function Viewer({
  label = "CT CHEST / AXIAL",
  mode = "axial",
  initialSlice,
}: ViewerProps) {
  const { imagingMode, sliceIndex, setSliceIndex, showToast } = useWorkspaceStore(
    useShallow((state) => ({
      imagingMode: state.imagingMode,
      sliceIndex: state.sliceIndex,
      setSliceIndex: state.setSliceIndex,
      showToast: state.showToast,
    })),
  );

  const currentSlice = initialSlice !== undefined ? initialSlice : sliceIndex;

  const handleToolClick = (tool: string) => {
    if (tool === "Measure") {
      showToast(
        "Measurement controls require a validated imaging pipeline. This is a schematic preview."
      );
    } else {
      showToast(
        "Window controls would adjust the source image display in the implemented viewer."
      );
    }
  };

  return (
    <div className="viewer">
      <div className="viewerbar">
        <span>{label}</span>
        <div className="row">
          <button
            type="button"
            onClick={() => handleToolClick("Window")}
            aria-label="Window level tool"
          >
            Window
          </button>
          <button
            type="button"
            onClick={() => handleToolClick("Measure")}
            aria-label="Measure tool"
          >
            Measure
          </button>
        </div>
      </div>

      <div className={`scan ${imagingMode === "localization" ? "crosshair" : ""}`}>
        <div className="scan-label">
          DEMO-024
          <br />
          Series 01 · Non-diagnostic
        </div>
        <ScanSVG type={mode} />
        <span className="scan-watermark">SCHEMATIC PREVIEW</span>
      </div>

      <div className="viewerbottom">
        <span>Slice</span>
        <input
          type="range"
          min="1"
          max="240"
          value={currentSlice}
          onChange={(e) => {
            const val = parseInt(e.target.value, 10);
            if (initialSlice === undefined) {
              setSliceIndex(val);
            }
          }}
          aria-label="Slice position"
          style={{ flex: 1 }}
        />
        <span className="slice-value">{currentSlice}/240</span>
        <span className="badge">Axial · Series 01</span>
      </div>
    </div>
  );
}
