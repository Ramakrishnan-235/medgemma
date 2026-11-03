"use client";

import React, { useEffect, useRef } from "react";
import { DiagnosticModality, WindowPreset } from "./types";

interface AxialViewportProps {
  slice: number;
  modality: DiagnosticModality;
  wlPreset: WindowPreset;
  crosshairX: number;
  crosshairY: number;
  onCrosshairChange: (x: number, y: number) => void;
  currentHuOrSignal: string;
}

export function AxialViewport({
  slice,
  modality,
  wlPreset,
  crosshairX,
  crosshairY,
  onCrosshairChange,
  currentHuOrSignal,
}: AxialViewportProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isMri = modality === "3d_mri";
  const roiTag = isMri ? "MRI-ROI-01" : "CT-ROI-01";

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // Palette depending on preset
    let fill = "#292524";
    let organ = "#46403C";
    let border = "#E8EFE8";

    if (wlPreset === "liver_dome" || wlPreset === "t1_contrast") {
      fill = "#35312E";
      organ = "#574E49";
    } else if (wlPreset === "lung" || wlPreset === "dwi_adc") {
      fill = "#23272A";
      organ = "#3B4248";
      border = "#EFEDF4";
    } else if (wlPreset === "bone" || wlPreset === "flair") {
      fill = "#2B2927";
      organ = "#78716C";
      border = "#FDFCF8";
    }

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#191716";
    ctx.fillRect(0, 0, w, h);

    // Body contour ellipse
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(w / 2, h / 2, 145, 118, 0, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = border;
    ctx.stroke();

    // Liver parenchyma contour (segment VII)
    const sliceFactor = Math.max(0.35, 1 - Math.abs(slice - 64) / 95);
    ctx.beginPath();
    ctx.ellipse(w * 0.41, h * 0.44, 68 * sliceFactor, 52 * sliceFactor, -0.25, 0, Math.PI * 2);
    ctx.fillStyle = organ;
    ctx.fill();
    ctx.strokeStyle = "rgba(232, 239, 232, 0.45)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Vertebral body / spine
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.72, 18, 0, Math.PI * 2);
    ctx.fillStyle = isMri ? "#B5B0A8" : "#D6D3CD";
    ctx.fill();

    // ROI Lesion when near Slice 64
    const dist64 = Math.abs(slice - 64);
    if (dist64 <= 12) {
      const radius = Math.max(4, 18 * (1 - dist64 / 13));
      const lx = w * 0.38;
      const ly = h * 0.42;

      ctx.beginPath();
      ctx.arc(lx, ly, radius, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255, 183, 178, 0.35)";
      ctx.fill();

      // Rounded Peach ROI bounding box
      ctx.strokeStyle = "#FFB7B2";
      ctx.lineWidth = 2;
      ctx.strokeRect(lx - 28, ly - 24, 56, 48);
    }

    // Crosshairs
    const cx = crosshairX * w;
    const cy = crosshairY * h;
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = "rgba(232, 239, 232, 0.55)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, h);
    ctx.moveTo(0, cy);
    ctx.lineTo(w, cy);
    ctx.stroke();
    ctx.restore();
  }, [slice, modality, wlPreset, crosshairX, crosshairY, isMri]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    onCrosshairChange(x, y);
  };

  return (
    <div className="wellness-card bg-white/90 border border-[#E8EFE8] p-6 flex flex-col justify-between space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-3 py-1 rounded-full bg-[#E8EFE8] text-xs font-semibold text-[#292524]">
              Axial plane
            </span>
            <span className="text-xs font-medium text-[#78716C]">
              Slice {slice} / 160
            </span>
          </div>
          <p className="font-expressive text-2xl text-[#78716C] mt-1">
            Cross-sectional liver dome view
          </p>
        </div>
        <span className="text-[11px] font-medium text-[#78716C] bg-[#FDFCF8] px-3 py-1 rounded-full border border-[#292524]/5">
          R: head-first supine
        </span>
      </div>

      {/* Interactive Axial Canvas */}
      <div className="relative rounded-[2rem] overflow-hidden bg-[#1E1C1A] aspect-square w-full flex items-center justify-center shadow-inner cursor-crosshair">
        <canvas
          ref={canvasRef}
          width={380}
          height={380}
          onClick={handleCanvasClick}
          className="w-full h-full block"
        />
        <div className="absolute top-4 left-4 bg-[#FDFCF8]/90 backdrop-blur-sm px-3 py-1 rounded-full text-[11px] font-semibold text-[#292524] border border-[#FFB7B2] shadow-sm pointer-events-none">
          [{roiTag} • 14.2mm]
        </div>
        <div className="absolute bottom-4 right-4 bg-[#292524]/80 backdrop-blur-sm text-[#FDFCF8] px-3 py-1 rounded-full text-[11px] pointer-events-none">
          Click to move crosshairs
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-[#78716C] pt-1 px-1">
        <span>Matrix: 512×512 • Fov: 350mm</span>
        <span className="font-semibold text-[#292524] bg-[#FFB7B2]/45 px-3 py-0.5 rounded-full">
          {currentHuOrSignal}
        </span>
      </div>
    </div>
  );
}

