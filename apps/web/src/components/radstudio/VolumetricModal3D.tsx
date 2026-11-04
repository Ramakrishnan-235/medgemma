"use client";

import React, { useState } from "react";
import type { LesionBox } from "./types";

interface VolumetricModal3DProps {
  isOpen: boolean;
  onClose: () => void;
  box01: LesionBox;
  onToast: (msg: string) => void;
}

export function VolumetricModal3D({
  isOpen,
  onClose,
  box01,
  onToast,
}: VolumetricModal3DProps) {
  const [rotation, setRotation] = useState(45);
  const [threshold, setThreshold] = useState(-300);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-3d-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in"
    >
      <div className="bg-[#0B0F14] rounded-2xl max-w-3xl w-full shadow-2xl border border-gray-800 text-white overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between bg-[#121820]">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            </svg>
            <h3 id="modal-3d-title" className="text-sm font-bold text-gray-100 font-mono">
              3D Cinematic Volumetric MIP & Tumor Mesh Reconstruction
            </h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close 3D View"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-800 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* 3D Canvas / Projection Display */}
        <div className="p-6 flex-1 flex flex-col items-center justify-center relative bg-radial from-[#151E28] via-[#0B0F14] to-black">
          <svg className="w-72 h-72 max-w-full drop-shadow-[0_0_35px_rgba(239,68,68,0.3)]" viewBox="0 0 200 200">
            {/* Thoracic 3D rib cage mesh silhouette */}
            <g transform={`rotate(${rotation}, 100, 100)`} opacity="0.6">
              <ellipse cx="100" cy="70" rx="60" ry="25" fill="none" stroke="#334155" strokeWidth="1.5" />
              <ellipse cx="100" cy="95" rx="68" ry="30" fill="none" stroke="#475569" strokeWidth="1.8" />
              <ellipse cx="100" cy="120" rx="72" ry="32" fill="none" stroke="#475569" strokeWidth="2" />
              <ellipse cx="100" cy="145" rx="65" ry="28" fill="none" stroke="#334155" strokeWidth="1.5" />
              {/* Spine column */}
              <line x1="100" y1="40" x2="100" y2="175" stroke="#64748B" strokeWidth="3" strokeDasharray="3 3" />
            </g>

            {/* Reconstructed 3D Tumor Mesh for BOX-01 */}
            <g transform="translate(135, 85)">
              <polygon
                points="0,-16 6,-8 18,-6 10,4 14,16 2,10 -8,18 -6,6 -16,0 -6,-6"
                fill="#EF4444"
                className="animate-pulse"
                opacity="0.9"
              />
              <circle cx="0" cy="0" r="14" fill="none" stroke="#FCA5A5" strokeWidth="1" strokeDasharray="2 2" />
              <text x="0" y="26" fill="#F87171" fontSize="7" textAnchor="middle" fontFamily="monospace">
                14.2mm ({box01.volumeCm3} cm³)
              </text>
            </g>
          </svg>

          {/* Interactive Controls Overlay */}
          <div className="mt-4 w-full max-w-md bg-gray-900/80 border border-gray-800 rounded-xl p-3 flex items-center justify-between gap-4 text-xs font-mono">
            <div className="flex-1 space-y-1">
              <div className="flex justify-between text-gray-400 text-[11px]">
                <span>Azimuth Orbit:</span>
                <span className="text-gray-200">{rotation}°</span>
              </div>
              <input
                type="range"
                min="0"
                max="360"
                value={rotation}
                onChange={(e) => setRotation(Number(e.target.value))}
                className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-red-500"
              />
            </div>

            <div className="flex-1 space-y-1">
              <div className="flex justify-between text-gray-400 text-[11px]">
                <span>Hounsfield Iso-surface:</span>
                <span className="text-gray-200">{threshold} HU</span>
              </div>
              <input
                type="range"
                min="-800"
                max="200"
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-red-500"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-800 flex items-center justify-between bg-[#121820]">
          <span className="text-xs text-gray-400 font-mono">
            Direct Volume Rendering (Ray marching 256 steps)
          </span>
          <button
            onClick={() => {
              onToast("Exported 3D DICOM-RT Structure Set");
              onClose();
            }}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors cursor-pointer"
          >
            Export RT-STRUCT
          </button>
        </div>
      </div>
    </div>
  );
}

