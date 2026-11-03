"use client";

import React, { useEffect, useRef } from "react";
import { DiagnosticModality, WindowPreset } from "./types";

interface CoronalViewportProps {
  slice: number;
  axialSlice: number;
  modality: DiagnosticModality;
  wlPreset: WindowPreset;
  crosshairX: number;
  syncLocked: boolean;
  onSliceClick: (slice: number) => void;
}

export function CoronalViewport({
  slice,
  axialSlice,
  wlPreset,
  crosshairX,
  syncLocked,
  onSliceClick,
}: CoronalViewportProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    let fill = "#292524";
    let organ = "#46403C";

    if (wlPreset === "liver_dome" || wlPreset === "t1_contrast") {
      fill = "#35312E";
      organ = "#574E49";
    } else if (wlPreset === "lung" || wlPreset === "dwi_adc") {
      fill = "#23272A";
      organ = "#3B4248";
    }

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#191716";
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    // Torso coronal outline
    ctx.beginPath();
    ctx.moveTo(w * 0.24, h * 0.16);
    ctx.quadraticCurveTo(w * 0.5, h * 0.1, w * 0.76, h * 0.16);
    ctx.lineTo(w * 0.82, h * 0.86);
    ctx.quadraticCurveTo(w * 0.5, h * 0.9, w * 0.18, h * 0.86);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = "#EFEDF4";
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Liver dome in coronal plane
    ctx.beginPath();
    ctx.ellipse(w * 0.4, h * 0.44, 62, 48, 0.15, 0, Math.PI * 2);
    ctx.fillStyle = organ;
    ctx.fill();

    // Lesion Z-span box
    ctx.strokeStyle = "#FFB7B2";
    ctx.fillStyle = "rgba(255, 183, 178, 0.22)";
    ctx.lineWidth = 2;
    ctx.fillRect(w * 0.31, h * 0.36, 54, 42);
    ctx.strokeRect(w * 0.31, h * 0.36, 54, 42);

    // Horizontal active Z-slice plane line
    const sliceY = (axialSlice / 160) * (h * 0.7) + h * 0.15;
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = "#FFB7B2";
    ctx.beginPath();
    ctx.moveTo(0, sliceY);
    ctx.lineTo(w, sliceY);
    ctx.moveTo(crosshairX * w, 0);
    ctx.lineTo(crosshairX * w, h);
    ctx.stroke();
    ctx.restore();
  }, [slice, axialSlice, wlPreset, crosshairX]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relY = (e.clientY - rect.top) / rect.height;
    const targetSlice = Math.round(((relY - 0.15) / 0.7) * 160);
    onSliceClick(targetSlice);
  };

  const volPosY = (210.4 + (axialSlice - 64) * 1.25).toFixed(1);

  return (
    <div className="wellness-card bg-white/90 border border-[#EFEDF4] p-6 flex flex-col justify-between space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-3 py-1 rounded-full bg-[#EFEDF4] text-xs font-semibold text-[#292524]">
              Coronal plane
            </span>
            <span className="text-xs font-medium text-[#78716C]">
              Slice {slice} / 160
            </span>
          </div>
          <p className="font-expressive text-2xl text-[#78716C] mt-1">
            Anterior-posterior reconstruction
          </p>
        </div>
        <span className="text-[11px] font-medium text-[#78716C] bg-[#FDFCF8] px-3 py-1 rounded-full border border-[#292524]/5">
          Recon // st: 1.25mm
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
        <div className="absolute top-4 left-4 bg-[#FDFCF8]/90 backdrop-blur-sm px-3 py-1 rounded-full text-[11px] font-semibold text-[#292524] border border-[#FFB7B2] shadow-sm pointer-events-none">
          Z-span: 12.0mm
        </div>
        <div className="absolute bottom-4 right-4 bg-[#292524]/80 backdrop-blur-sm text-[#FDFCF8] px-3 py-1 rounded-full text-[11px] pointer-events-none">
          Click Y to jump slice
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-[#78716C] pt-1 px-1">
        <span>Vol-pos: y: {volPosY}mm</span>
        <span className="font-semibold text-[#292524] bg-[#E8EFE8] px-3 py-0.5 rounded-full">
          {syncLocked ? "Sync: locked" : "Sync: unlocked"}
        </span>
      </div>
    </div>
  );
}

