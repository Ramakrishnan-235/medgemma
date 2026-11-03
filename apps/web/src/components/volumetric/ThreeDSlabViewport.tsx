"use client";

import React, { useEffect, useRef, useState } from "react";
import { DiagnosticModality, SlabMode } from "./types";

interface ThreeDSlabViewportProps {
  axialSlice: number;
  modality: DiagnosticModality;
  currentSlabMode: SlabMode;
  azimuth: number;
  setAzimuth: React.Dispatch<React.SetStateAction<number>>;
  elevation: number;
  setElevation: React.Dispatch<React.SetStateAction<number>>;
  autoOrbit: boolean;
  setAutoOrbit: React.Dispatch<React.SetStateAction<boolean>>;
  onToast: (msg: string) => void;
}

export function ThreeDSlabViewport({
  axialSlice,
  modality,
  currentSlabMode,
  azimuth,
  setAzimuth,
  elevation,
  setElevation,
  autoOrbit,
  setAutoOrbit,
  onToast,
}: ThreeDSlabViewportProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const lastMousePos = useRef({ x: 0, y: 0 });

  const isMri = modality === "3d_mri";
  const targetTag = isMri ? "[MRI-ROI-01]" : "[CT-ROI-01]";

  // 3D Canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#191716";
    ctx.fillRect(0, 0, w, h);

    const az = (azimuth * Math.PI) / 180;
    const el = (elevation * Math.PI) / 180;
    const scale = 88;

    function project(x: number, y: number, z: number): [number, number] {
      const x1 = x * Math.cos(az) - z * Math.sin(az);
      const z1 = x * Math.sin(az) + z * Math.cos(az);
      const y2 = y * Math.cos(el) - z1 * Math.sin(el);
      return [w / 2 + x1 * scale, h / 2 + y2 * scale];
    }

    const vertices = [
      [-1, -1, -1],
      [1, -1, -1],
      [1, 1, -1],
      [-1, 1, -1],
      [-1, -1, 1],
      [1, -1, 1],
      [1, 1, 1],
      [-1, 1, 1],
    ].map(([x, y, z]) => project(x, y, z));

    const edges = [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
      [4, 5],
      [5, 6],
      [6, 7],
      [7, 4],
      [0, 4],
      [1, 5],
      [2, 6],
      [3, 7],
    ];

    ctx.save();
    // Bounding cube wireframe
    ctx.strokeStyle = "rgba(232, 239, 232, 0.35)";
    ctx.lineWidth = 1.4;
    edges.forEach(([i, j]) => {
      ctx.beginPath();
      ctx.moveTo(vertices[i][0], vertices[i][1]);
      ctx.lineTo(vertices[j][0], vertices[j][1]);
      ctx.stroke();
    });

    // Active Z-slice plane
    const zNorm = (axialSlice / 160) * 2 - 1;
    const sliceQuad = [
      project(-1, zNorm, -1),
      project(1, zNorm, -1),
      project(1, zNorm, 1),
      project(-1, zNorm, 1),
    ];
    ctx.beginPath();
    ctx.moveTo(sliceQuad[0][0], sliceQuad[0][1]);
    sliceQuad.slice(1).forEach(([px, py]) => ctx.lineTo(px, py));
    ctx.closePath();
    ctx.fillStyle = "rgba(239, 237, 244, 0.12)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 183, 178, 0.6)";
    ctx.stroke();

    // Portal vessel tree branches
    const vRoot = project(0.0, 0.5, 0.0);
    const vMid = project(-0.15, 0.05, 0.1);
    const vBranch1 = project(-0.42, -0.25, 0.2);
    const vBranch2 = project(0.25, -0.2, -0.15);

    ctx.strokeStyle = "#E8EFE8";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(vRoot[0], vRoot[1]);
    ctx.lineTo(vMid[0], vMid[1]);
    ctx.lineTo(vBranch1[0], vBranch1[1]);
    ctx.moveTo(vMid[0], vMid[1]);
    ctx.lineTo(vBranch2[0], vBranch2[1]);
    ctx.stroke();

    // Glowing Peach 3D Lesion ROI Sphere at vBranch1
    const glow = ctx.createRadialGradient(
      vBranch1[0],
      vBranch1[1],
      2,
      vBranch1[0],
      vBranch1[1],
      24
    );
    glow.addColorStop(0, "#FFB7B2");
    glow.addColorStop(1, "rgba(255, 183, 178, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(vBranch1[0], vBranch1[1], 24, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#FFB7B2";
    ctx.beginPath();
    ctx.arc(vBranch1[0], vBranch1[1], 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#FDFCF8";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }, [azimuth, elevation, axialSlice]);

  // Gentle auto-orbit loop
  useEffect(() => {
    if (!autoOrbit || isDragging) return;
    const interval = setInterval(() => {
      setAzimuth((prev) => (prev + 1) % 360);
    }, 90);
    return () => clearInterval(interval);
  }, [autoOrbit, isDragging, setAzimuth]);

  // Pointer drag events
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setAutoOrbit(false);
    lastMousePos.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    const dx = e.clientX - lastMousePos.current.x;
    const dy = e.clientY - lastMousePos.current.y;
    setAzimuth((prev) => Math.round((prev + dx * 0.6) % 360));
    setElevation((prev) =>
      Math.max(-75, Math.min(75, Math.round(prev + dy * 0.5)))
    );
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    setIsDragging(false);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }
  };

  const handleResetAngle = () => {
    setAzimuth(-18);
    setElevation(34);
    onToast("3d slab orientation reset to [-18°, 34°]");
  };

  return (
    <div className="wellness-card bg-white/90 border border-[#E8EFE8] p-6 flex flex-col justify-between space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-3 py-1 rounded-full bg-[#FFB7B2] text-xs font-semibold text-[#292524]">
              3d volumetric slab
            </span>
            <span className="text-xs font-medium text-[#78716C]">
              Ray-casting mip • {currentSlabMode}
            </span>
          </div>
          <p className="font-expressive text-2xl text-[#78716C] mt-1">
            Drag to rotate 3d vessel &amp; roi mesh
          </p>
        </div>
        <span className="text-[11px] font-medium text-[#292524] bg-[#FDFCF8] px-3 py-1 rounded-full border border-[#292524]/5">
          Az {azimuth}° | El {elevation}°
        </span>
      </div>

      <div className="relative rounded-[2rem] overflow-hidden bg-[#1E1C1A] aspect-square w-full flex items-center justify-center shadow-inner cursor-grab active:cursor-grabbing">
        <canvas
          ref={canvasRef}
          width={380}
          height={380}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="w-full h-full block"
        />
        <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
          <button
            onClick={() => setAutoOrbit((prev) => !prev)}
            type="button"
            className="px-3.5 py-1.5 rounded-full bg-[#FDFCF8]/90 hover:bg-[#FFB7B2] text-[#292524] text-[11px] font-semibold shadow-sm transition cursor-pointer"
          >
            Auto-orbit: {autoOrbit ? "on" : "off"}
          </button>
          <button
            onClick={handleResetAngle}
            type="button"
            className="px-3.5 py-1.5 rounded-full bg-[#FDFCF8]/90 hover:bg-[#E8EFE8] text-[#292524] text-[11px] font-semibold shadow-sm transition cursor-pointer"
          >
            Reset angle
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-[#78716C] pt-1 px-1">
        <span>Voxel spacing: 0.68×0.68×1.25mm</span>
        <span className="font-semibold text-[#292524]">
          Target: {targetTag}
        </span>
      </div>
    </div>
  );
}

