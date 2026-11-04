"use client";

import React, { useState } from "react";
import type {
  WlPresetType,
  ViewportToolType,
  SeriesType,
  LesionBox,
} from "./types";

interface CtViewportProps {
  series: SeriesType;
  slice: number;
  totalSlices: number;
  zPositionMm: string;
  setSlice: (s: number | ((prev: number) => number)) => void;
  isPlaying: boolean;
  setIsPlaying: (p: boolean | ((prev: boolean) => boolean)) => void;
  wlPreset: WlPresetType;
  setWlPreset: (preset: WlPresetType) => void;
  activeTool: ViewportToolType;
  setActiveTool: (tool: ViewportToolType) => void;
  zoomPercent: number;
  setZoomPercent: (z: number | ((prev: number) => number)) => void;
  isInverted: boolean;
  setIsInverted: (inv: boolean | ((prev: boolean) => boolean)) => void;
  highlightedBox: string | null;
  setHighlightedBox: (id: string | null) => void;
  splitSync: boolean;
  setSplitSync: (s: boolean | ((prev: boolean) => boolean)) => void;
  heatmapEnabled: boolean;
  setHeatmapEnabled: (h: boolean | ((prev: boolean) => boolean)) => void;
  onOpen3dView: () => void;
  onToast: (msg: string) => void;
  box01: LesionBox;
  box02: LesionBox;
}

export function CtViewport({
  series,
  slice,
  totalSlices,
  zPositionMm,
  setSlice,
  isPlaying,
  setIsPlaying,
  wlPreset,
  setWlPreset,
  activeTool,
  setActiveTool,
  zoomPercent,
  setZoomPercent,
  isInverted,
  setIsInverted,
  highlightedBox,
  setHighlightedBox,
  splitSync,
  setSplitSync,
  heatmapEnabled,
  setHeatmapEnabled,
  onOpen3dView,
  onToast,
  box01,
  box02,
}: CtViewportProps) {
  const [isHoveringViewer, setIsHoveringViewer] = useState(false);

  // W/L preset labels and values
  const presets: { id: WlPresetType; label: string }[] = [
    { id: "lung", label: "Lung (W:1500 L:-600)" },
    { id: "bone", label: "Bone (W:2000 L:500)" },
    { id: "mediastinal", label: "Mediastinal (W:350 L:40)" },
    { id: "brain", label: "Brain" },
  ];

  // Calculate dynamic opacity of lesion based on slice proximity
  const sliceDistanceBox01 = Math.abs(slice - box01.sliceIndex);
  const showBox01 = series === "axial" && sliceDistanceBox01 <= 8;
  const opacityBox01 = showBox01 ? Math.max(0.2, 1 - sliceDistanceBox01 * 0.12) : 0;
  const isBox01Exact = slice === box01.sliceIndex;

  const sliceDistanceBox02 = Math.abs(slice - box02.sliceIndex);
  const showBox02 = series === "axial" && sliceDistanceBox02 <= 8;
  const opacityBox02 = showBox02 ? Math.max(0.2, 1 - sliceDistanceBox02 * 0.12) : 0;
  const isBox02Exact = slice === box02.sliceIndex;

  // Visual filter depending on Window/Level Preset & Invert
  const getFilterStyle = () => {
    let contrast = "100%";
    let brightness = "100%";
    if (wlPreset === "lung") {
      contrast = "115%";
      brightness = "95%";
    } else if (wlPreset === "bone") {
      contrast = "160%";
      brightness = "110%";
    } else if (wlPreset === "mediastinal") {
      contrast = "130%";
      brightness = "85%";
    } else if (wlPreset === "brain") {
      contrast = "140%";
      brightness = "90%";
    }
    return {
      filter: `${isInverted ? "invert(100%) " : ""}contrast(${contrast}) brightness(${brightness})`,
    };
  };

  return (
    <div className="flex-1 flex flex-col bg-[#F8FAFC] p-3 overflow-hidden select-none">
      {/* Top Controls Toolbar: W/L Presets & Tools */}
      <div className="flex items-center justify-between pb-2 shrink-0">
        {/* Left: Window/Level Presets */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-semibold text-gray-500 mr-1">
            W/L:
          </span>
          {presets.map((p) => {
            const isActive = wlPreset === p.id;
            return (
              <button
                key={p.id}
                onClick={() => {
                  setWlPreset(p.id);
                  onToast(`Window/Level applied: ${p.label}`);
                }}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
                  isActive
                    ? "bg-[#331C1A] text-[#FFB4AB] border border-[#522926] shadow-xs"
                    : "bg-white hover:bg-gray-100 text-gray-700 border border-gray-200"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* Right: Viewport Interactive Tools */}
        <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-gray-200/80 shadow-2xs">
          {/* Pan */}
          <button
            onClick={() => {
              setActiveTool("pan");
              onToast("Tool: Pan viewport active");
            }}
            title="Pan Tool"
            aria-label="Pan Tool"
            className={`w-7 h-7 rounded flex items-center justify-center transition-colors cursor-pointer ${
              activeTool === "pan"
                ? "bg-gray-900 text-white"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            }`}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 11V6a2 2 0 0 0-4 0v5M14 10V4a2 2 0 0 0-4 0v7M10 10.5V6a2 2 0 0 0-4 0v8" />
              <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
            </svg>
          </button>

          {/* Zoom */}
          <button
            onClick={() => {
              setActiveTool("zoom");
              setZoomPercent((z) => (z >= 180 ? 100 : z + 20));
              onToast(`Tool: Zoom set to ${zoomPercent >= 180 ? 100 : zoomPercent + 20}%`);
            }}
            title="Zoom Tool"
            aria-label="Zoom Tool"
            className={`w-7 h-7 rounded flex items-center justify-center transition-colors cursor-pointer ${
              activeTool === "zoom"
                ? "bg-gray-900 text-white"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            }`}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
              <line x1="11" y1="8" x2="11" y2="14" />
              <line x1="8" y1="11" x2="14" y2="11" />
            </svg>
          </button>

          {/* Measure / Caliper */}
          <button
            onClick={() => {
              setActiveTool("measure");
              onToast("Tool: Caliper & 2D RECIST measurement active");
            }}
            title="Measure / Caliper Tool"
            aria-label="Measure / Caliper Tool"
            className={`w-7 h-7 rounded flex items-center justify-center transition-colors cursor-pointer ${
              activeTool === "measure"
                ? "bg-gray-900 text-white"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            }`}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M2 12h20M7 8v8M12 9v6M17 8v8" />
            </svg>
          </button>

          {/* Crosshair */}
          <button
            onClick={() => {
              setActiveTool("crosshair");
              onToast("Tool: 3D Crosshair cursor active");
            }}
            title="Crosshair Tool"
            aria-label="Crosshair Tool"
            className={`w-7 h-7 rounded flex items-center justify-center transition-colors cursor-pointer ${
              activeTool === "crosshair"
                ? "bg-gray-900 text-white"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            }`}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="22" y1="12" x2="18" y2="12" />
              <line x1="6" y1="12" x2="2" y2="12" />
              <line x1="12" y1="6" x2="12" y2="2" />
              <line x1="12" y1="22" x2="12" y2="18" />
            </svg>
          </button>

          {/* Bounding Box / Annotate */}
          <button
            onClick={() => {
              setActiveTool("box");
              onToast("Tool: Visual Grounding Box Annotation toggled");
            }}
            title="Visual Grounding Annotation Box"
            aria-label="Visual Grounding Annotation Box"
            className={`w-7 h-7 rounded flex items-center justify-center transition-colors cursor-pointer ${
              activeTool === "box"
                ? "bg-gray-900 text-white"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            }`}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="3 3" />
            </svg>
          </button>

          {/* Invert */}
          <button
            onClick={() => {
              setIsInverted((inv) => !inv);
              onToast(`Grayscale Inversion: ${!isInverted ? "ON" : "OFF"}`);
            }}
            title="Invert Grayscale"
            aria-label="Invert Grayscale"
            className={`w-7 h-7 rounded flex items-center justify-center transition-colors cursor-pointer ${
              isInverted
                ? "bg-gray-900 text-white"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            }`}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 0 1 0-16z" />
            </svg>
          </button>

          {/* Fullscreen / Expand */}
          <button
            onClick={() => onToast("Viewport expanded to maximum resolution")}
            title="Toggle Viewport Fullscreen"
            aria-label="Toggle Viewport Fullscreen"
            className="w-7 h-7 rounded flex items-center justify-center text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Main Viewport Display Area (Black Container) */}
      <div
        onMouseEnter={() => setIsHoveringViewer(true)}
        onMouseLeave={() => setIsHoveringViewer(false)}
        className="relative flex-1 rounded-2xl bg-[#080B0E] overflow-hidden flex items-center justify-center border border-gray-800 shadow-xl"
      >
        {/* Anatomical Orientation HUD Overlays */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 text-[11px] font-mono font-bold tracking-widest text-gray-400/80 pointer-events-none uppercase">
          ANTERIOR
        </div>
        <div className="absolute bottom-14 left-1/2 -translate-x-1/2 text-[11px] font-mono font-bold tracking-widest text-gray-500/80 pointer-events-none uppercase">
          POSTERIOR
        </div>
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-gray-400/80 pointer-events-none">
          R
        </div>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-gray-400/80 pointer-events-none">
          L
        </div>

        {/* Heatmap Layer if Enabled */}
        {heatmapEnabled && (
          <div className="absolute inset-0 pointer-events-none z-10 opacity-30 mix-blend-screen bg-radial from-red-600 via-amber-500 to-transparent blur-md" />
        )}

        {/* Realistic High-Fidelity Thoracic CT SVG Viewport */}
        <div
          style={getFilterStyle()}
          className="w-full h-full max-w-[620px] max-h-[620px] p-4 flex items-center justify-center transition-all duration-200"
        >
          <svg
            className="w-full h-full"
            viewBox="0 0 500 500"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Thoracic Outer Skin & Subcutaneous Fat */}
            <ellipse
              cx="250"
              cy="255"
              rx="210"
              ry="165"
              fill="#182028"
              stroke="#2E3B4B"
              strokeWidth="5"
            />

            {/* Thoracic Wall & Musculature */}
            <ellipse
              cx="250"
              cy="255"
              rx="195"
              ry="150"
              fill="#0F141A"
              stroke="#222C38"
              strokeWidth="4"
            />

            {/* Sternum (Anterior bone) */}
            <path
              d="M236 112 H264 V120 H236 Z"
              fill="#94A3B8"
              stroke="#CBD5E1"
              strokeWidth="1.5"
            />

            {/* Vertebral Body & Spinal Canal (Posterior bone) */}
            <g>
              <ellipse cx="250" cy="370" rx="22" ry="16" fill="#94A3B8" stroke="#E2E8F0" strokeWidth="2" />
              {/* Spinal canal */}
              <ellipse cx="250" cy="365" rx="8" ry="6" fill="#080B0E" />
              {/* Spinous process */}
              <polygon points="250,386 244,402 256,402" fill="#64748B" />
              {/* Transverse processes */}
              <ellipse cx="220" cy="368" rx="8" ry="4" fill="#64748B" />
              <ellipse cx="280" cy="368" rx="8" ry="4" fill="#64748B" />
            </g>

            {/* Bilateral Ribs (Curved bone sections) */}
            <g stroke="#94A3B8" strokeWidth="3" fill="#64748B">
              <ellipse cx="88" cy="210" rx="6" ry="14" />
              <ellipse cx="78" cy="255" rx="6" ry="15" />
              <ellipse cx="86" cy="305" rx="6" ry="14" />
              <ellipse cx="110" cy="350" rx="8" ry="12" />

              <ellipse cx="412" cy="210" rx="6" ry="14" />
              <ellipse cx="422" cy="255" rx="6" ry="15" />
              <ellipse cx="414" cy="305" rx="6" ry="14" />
              <ellipse cx="390" cy="350" rx="8" ry="12" />
            </g>

            {/* Right Lung Field (Dark radiolucent area, anatomical right = left of image) */}
            <path
              d="M228 140 C170 140, 105 170, 95 240 C85 305, 120 365, 200 375 C215 377, 226 350, 226 300 C226 230, 232 170, 228 140 Z"
              fill="#06090D"
              stroke="#1E293B"
              strokeWidth="2.5"
            />

            {/* Left Lung Field (Dark radiolucent area, anatomical left = right of image) */}
            <path
              d="M272 140 C330 140, 395 170, 405 240 C415 305, 380 365, 300 375 C285 377, 274 350, 274 300 C274 230, 268 170, 272 140 Z"
              fill="#06090D"
              stroke="#1E293B"
              strokeWidth="2.5"
            />

            {/* Pulmonary Bronchovascular Markings in Right Lung */}
            <g stroke="#1F2937" strokeWidth="1.8" strokeLinecap="round" opacity="0.85">
              <path d="M210 240 Q175 220 140 215" />
              <path d="M175 220 Q160 190 145 175" />
              <path d="M175 220 Q165 250 135 265" />
              <path d="M195 280 Q160 300 135 320" />
            </g>

            {/* Pulmonary Bronchovascular Markings in Left Lung */}
            <g stroke="#1F2937" strokeWidth="1.8" strokeLinecap="round" opacity="0.85">
              <path d="M290 240 Q325 220 360 215" />
              <path d="M325 220 Q340 190 355 175" />
              <path d="M325 220 Q335 250 365 265" />
              <path d="M305 280 Q340 300 365 320" />
            </g>

            {/* Central Mediastinum & Cardiac Silhouette */}
            <ellipse
              cx="250"
              cy="255"
              rx="40"
              ry="75"
              fill="#141B22"
              stroke="#2E3C4E"
              strokeWidth="2"
            />
            {/* Ascending / Descending Aorta and Main Pulmonary Artery */}
            <circle cx="242" cy="225" r="14" fill="#1E2836" stroke="#37475E" strokeWidth="2" />
            <circle cx="260" cy="305" r="16" fill="#1A2330" stroke="#334358" strokeWidth="2" />
            <circle cx="235" cy="275" r="18" fill="#1A2330" stroke="#334358" strokeWidth="2" />

            {/* LESION 1: Right Upper Lobe Spiculated Nodule (Primary Detection) */}
            {showBox01 && (
              <g
                style={{ opacity: opacityBox01 }}
                className="transition-opacity duration-300"
              >
                {/* Spiculated Starburst Nodule Body (Anatomical Right Lung, Slice ~42) */}
                <g transform="translate(162, 238)">
                  {/* Peripheral micro-spiculations */}
                  <path
                    d="M 0 -14 L 3 -6 L 12 -12 L 6 -2 L 15 0 L 7 4 L 13 11 L 3 6 L 0 15 L -3 6 L -13 12 L -7 3 L -15 0 L -7 -3 L -12 -11 L -3 -6 Z"
                    fill="#E2E8F0"
                    stroke="#F8FAFC"
                    strokeWidth="1.2"
                    className="drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]"
                  />
                  {/* Ground glass halo */}
                  <circle cx="0" cy="0" r="16" fill="rgba(226, 232, 240, 0.15)" />
                  {/* Dense core */}
                  <circle cx="0" cy="0" r="5" fill="#FFFFFF" />
                </g>

                {/* Caliper Measurement Line: 14.2 mm */}
                <g stroke="#EF4444" strokeWidth="1.5">
                  <line x1="148" y1="238" x2="176" y2="238" />
                  <line x1="148" y1="234" x2="148" y2="242" />
                  <line x1="176" y1="234" x2="176" y2="242" />
                  <rect x="151" y="227" width="22" height="9" rx="2" fill="#1E293B" />
                  <text
                    x="162"
                    y="234"
                    fill="#FCA5A5"
                    fontSize="6.5"
                    fontFamily="monospace"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    14.2mm
                  </text>
                </g>

                {/* Red Bounding Box [xmin: 130, ymin: 205, xmax: 194, ymax: 270] */}
                <rect
                  x="128"
                  y="204"
                  width="68"
                  height="68"
                  rx="3"
                  fill="none"
                  stroke="#DC2626"
                  strokeWidth={isBox01Exact ? "2" : "1.5"}
                  strokeDasharray={isBox01Exact ? "none" : "4 2"}
                />

                {/* Bounding Box Label Tag */}
                <g transform="translate(126, 192)">
                  <rect
                    x="0"
                    y="0"
                    width="196"
                    height="13"
                    rx="6.5"
                    fill="#DC2626"
                    className="shadow-sm"
                  />
                  <circle cx="6" cy="6.5" r="2.5" fill="#FFFFFF" />
                  <text
                    x="13"
                    y="9.2"
                    fill="#FFFFFF"
                    fontSize="7"
                    fontFamily="sans-serif"
                    fontWeight="600"
                  >
                    BOX-01: RUL Spiculated Nodule • 14.2mm
                  </text>
                  <text
                    x="146"
                    y="9.2"
                    fill="#FEE2E2"
                    fontSize="6.5"
                    fontFamily="monospace"
                  >
                    [0.380, 0.620, 0.490]
                  </text>
                </g>
              </g>
            )}

            {/* LESION 2: Left Lower Lobe Subpleural Nodule (Slice ~65) */}
            {showBox02 && (
              <g
                style={{ opacity: opacityBox02 }}
                className="transition-opacity duration-300"
              >
                {/* 6.5mm Subpleural Nodule */}
                <g transform="translate(345, 310)">
                  <circle cx="0" cy="0" r="5" fill="#E2E8F0" stroke="#F1F5F9" strokeWidth="1" />
                  <circle cx="0" cy="0" r="8" fill="rgba(245, 158, 11, 0.2)" />
                </g>

                {/* Amber Bounding Box */}
                <rect
                  x="330"
                  y="295"
                  width="32"
                  height="32"
                  rx="2"
                  fill="none"
                  stroke="#D97706"
                  strokeWidth="1.5"
                />

                {/* Label Tag */}
                <g transform="translate(320, 283)">
                  <rect
                    x="0"
                    y="0"
                    width="142"
                    height="12"
                    rx="6"
                    fill="#D97706"
                  />
                  <text
                    x="8"
                    y="8.5"
                    fill="#FFFFFF"
                    fontSize="6.5"
                    fontFamily="sans-serif"
                    fontWeight="600"
                  >
                    BOX-02: LLL Subpleural • 6.5mm
                  </text>
                </g>
              </g>
            )}
          </svg>
        </div>

        {/* Bottom Viewer Overlay Bar (Inside dark canvas bottom) */}
        <div className="absolute bottom-3 left-4 right-4 bg-white/95 backdrop-blur-md rounded-xl p-2 px-3 flex items-center justify-between border border-gray-200/80 shadow-md">
          {/* Left: Play/Pause, Slice Info */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setIsPlaying((p) => !p);
                onToast(isPlaying ? "Paused Cine playback" : "Starting Cine playback loop");
              }}
              title={isPlaying ? "Pause Cineloop" : "Play Cineloop (Spacebar)"}
              aria-label={isPlaying ? "Pause Cineloop" : "Play Cineloop"}
              className="w-7 h-7 rounded-full bg-gray-900 text-white flex items-center justify-center hover:bg-black transition-transform active:scale-95 cursor-pointer shadow-xs"
            >
              {isPlaying ? (
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5 ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              )}
            </button>

            <button
              onClick={() => setHighlightedBox(highlightedBox ? null : "BOX-01")}
              title="Target Slice Indicator"
              aria-label="Toggle Box Highlight"
              className="text-red-500 hover:text-red-700"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="12 2 2 22 22 22" />
              </svg>
            </button>

            <div className="flex items-baseline gap-1 text-xs">
              <span className="font-semibold text-gray-900">
                Slice: {slice} / {totalSlices}
              </span>
              <span className="text-gray-500 font-mono text-[11px]">
                (Z: {zPositionMm}mm)
              </span>
            </div>
          </div>

          {/* Middle: Interactive Scrubber Slider */}
          <div className="flex-1 max-w-sm mx-4 flex items-center gap-2">
            <button
              onClick={() => setSlice((s) => Math.max(1, s - 1))}
              aria-label="Previous slice"
              className="w-5 h-5 rounded flex items-center justify-center text-gray-400 hover:text-gray-800 hover:bg-gray-100 cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            <div className="relative flex-1 flex items-center">
              <input
                type="range"
                min="1"
                max={totalSlices}
                value={slice}
                onChange={(e) => setSlice(Number(e.target.value))}
                aria-label="CT axial slice position"
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-red-600 focus:outline-none"
              />
              {/* Highlight marker dot for Box 01 at Slice 42 */}
              <div
                title="BOX-01 (Slice 42)"
                style={{ left: `${(42 / totalSlices) * 100}%` }}
                className="absolute w-2 h-2 -top-0.5 rounded-full bg-red-500 border border-white pointer-events-none"
              />
              {/* Highlight marker dot for Box 02 at Slice 65 */}
              <div
                title="BOX-02 (Slice 65)"
                style={{ left: `${(65 / totalSlices) * 100}%` }}
                className="absolute w-2 h-2 -top-0.5 rounded-full bg-amber-500 border border-white pointer-events-none"
              />
            </div>

            <button
              onClick={() => setSlice((s) => Math.min(totalSlices, s + 1))}
              aria-label="Next slice"
              className="w-5 h-5 rounded flex items-center justify-center text-gray-400 hover:text-gray-800 hover:bg-gray-100 cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>

          {/* Right: Technical Viewport State (FOV, Zoom, HU) */}
          <div className="flex items-center gap-2 font-mono text-[10px] text-gray-500">
            <span>FOV: 360mm</span>
            <span>•</span>
            <span>Zoom: {zoomPercent}%</span>
            <span>•</span>
            <span className="font-semibold text-gray-800">
              HU: {slice === 42 ? "+45" : slice === 65 ? "+22" : "-620"}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Footer Actions Bar */}
      <div className="pt-2 px-1 flex items-center justify-between shrink-0 select-none">
        {/* Left Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Split Sync */}
          <button
            onClick={() => {
              setSplitSync((s) => !s);
              onToast(`Split Sync mode: ${!splitSync ? "ACTIVE" : "DISABLED"}`);
            }}
            className={`px-3 py-1 rounded-md text-xs font-medium border flex items-center gap-1.5 transition-colors cursor-pointer ${
              splitSync
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white text-gray-700 hover:bg-gray-100 border-gray-200"
            }`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="12" y1="3" x2="12" y2="21" />
            </svg>
            Split Sync
          </button>

          {/* Temporal Diff Heatmap */}
          <button
            onClick={() => {
              setHeatmapEnabled((h) => !h);
              onToast(`Temporal Diff Heatmap: ${!heatmapEnabled ? "ON" : "OFF"}`);
            }}
            className={`px-3 py-1 rounded-md text-xs font-medium border flex items-center gap-1.5 transition-colors cursor-pointer ${
              heatmapEnabled
                ? "bg-red-600 text-white border-red-600"
                : "bg-white text-gray-700 hover:bg-gray-100 border-gray-200"
            }`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            Temporal Diff Heatmap
          </button>

          {/* 3D Volumetric View */}
          <button
            onClick={onOpen3dView}
            className="px-3 py-1 rounded-md text-xs font-medium bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            </svg>
            3D Volumetric View
          </button>
        </div>

        {/* Right Acquisition Specs */}
        <div className="font-mono text-[10px] text-gray-400 flex items-center gap-1.5">
          <span>120 kVp</span>
          <span>•</span>
          <span>240 mA</span>
          <span>•</span>
          <span>Recon: B60f Sharp</span>
          <span>•</span>
          <span className="font-semibold text-gray-600">Cornerstone3D v2.0</span>
        </div>
      </div>
    </div>
  );
}

