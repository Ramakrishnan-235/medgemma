"use client";

import React, { useEffect, useRef } from "react";
import { DiagnosticModality, WindowPreset } from "./types";

interface SagittalViewportProps {
  slice: number;
  axialSlice: number;
  modality: DiagnosticModality;
  wlPreset: WindowPreset;
  crosshairY: number;
  onSliceClick: (slice: number) => void;
}

export function SagittalViewport({
  slice,
  axialSlice,
  modality,
  wlPreset,
  crosshairY,
  onSliceClick,
}: SagittalViewportProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isMri = modality === "3d_mri";

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    let fill = "#292524";
    if (wlPreset === "liver_dome" || wlPreset === "t1_contrast") {
      fill = "#35312E";
    } else if (wlPreset === "lung" || wlPreset === "dwi_adc") {
      fill = "#23272A";
    }

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#191716";
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    // Sagittal profile contour
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.52, 95, 138, 0, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = "#EFEDF4";
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Posterior spine column segments
    ctx.fillStyle = isMri ? "rgba(220, 215, 230, 0.45)" : "rgba(239, 237, 244, 0.45)";
    for (let i = 0; i < 7; i++) {
      ctx.fillRect(w * 0.64, h * (0.22 + i * 0.085), 16, 18);
    }

    // Sagittal ROI projection
    ctx.fillStyle = "rgba(255, 183, 178, 0.25)";
    ctx.strokeStyle = "#FFB7B2";
    ctx.lineWidth = 2;
    ctx.fillRect(w * 0.36, h * 0.36, 50, 44);
    ctx.strokeRect(w * 0.36, h * 0.36, 50, 44);

    const sliceY = (axialSlice / 160) * (h * 0.7) + h * 0.15;
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = "rgba(232, 239, 232, 0.6)";
    ctx.beginPath();
    ctx.moveTo(0, sliceY);
    ctx.lineTo(w, sliceY);
    ctx.moveTo(crosshairY * w, 0);
    ctx.lineTo(crosshairY * w, h);
    ctx.stroke();
    ctx.restore();
  }, [slice, axialSlice, wlPreset, crosshairY, isMri]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relY = (e.clientY - rect.top) / rect.height;
    const targetSlice = Math.round(((relY - 0.15) / 0.7) * 160);
    onSliceClick(targetSlice);
  };

  return (
    <div className="wellness-card bg-white/90 border border-[#EFEDF4] p-6 flex flex-col justify-between space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-3 py-1 rounded-full bg-[#EFEDF4] text-xs font-semibold text-[#292524]">
              Sagittal plane
            </span>
            <span className="text-xs font-medium text-[#78716C]">
              Slice {slice} / 160
            </span>
          </div>
          <p className="font-expressive text-2xl text-[#78716C] mt-1">
            Lateral vertebral &amp; hepatic profile
          </p>
        </div>
        <span className="text-[11px] font-medium text-[#78716C] bg-[#FDFCF8] px-3 py-1 rounded-full border border-[#292524]/5">
          Series: 04/08
        </span>
      </div>

      <div className="relative rounded-[2rem] overflow-hidden bg-[#1E1C1A] aspect-square w-full flex items-center justify-center shadow-inner cursor-crosshair">
        <canvas
          ref={canvasRef}
          width={380}
          height={380}
          onClick={handleCanvasClick}
          className="w-full h-full block"
        />
        <div className="absolute top-4 left-4 bg-[#FDFCF8]/90 backdrop-blur-sm px-3 py-1 rounded-full text-[11px] font-semibold text-[#292524] pointer-events-none">
          Hepatic segment VII
        </div>
        <div className="absolute bottom-4 right-4 bg-[#292524]/80 backdrop-blur-sm text-[#FDFCF8] px-3 py-1 rounded-full text-[11px] pointer-events-none">
          Click Y to jump slice
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-[#78716C] pt-1 px-1">
        <span>{isMri ? "Field: 3.0 Tesla • SAR: 1.2W/kg" : "kVp: 120 • Kernel: B30f"}</span>
        <span className="font-medium text-[#292524]">Thickness: 1.25mm</span>
      </div>
    </div>
  );
}

