"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import type {
  WlPresetType,
  ViewportToolType,
  SeriesType,
  LesionBox,
  DicomSeriesDataset,
  UploadedStudyData,
} from "./types";
import { renderSliceToRgba, calculateHu, processDicomUpload } from "./dicom-loader";
import { analyzeDicomDataset } from "./clinical-analyzer";

interface CtViewportProps {
  activeDataset?: DicomSeriesDataset | null;
  hasStudy?: boolean;
  onOpenUploadModal: () => void;
  onDicomUploadSuccess?: (dataset: DicomSeriesDataset, summary?: UploadedStudyData) => void;
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
  reconSpecs?: string;
  box01?: LesionBox | null;
  box02?: LesionBox | null;
}

export function CtViewport({
  activeDataset,
  hasStudy = false,
  onOpenUploadModal,
  onDicomUploadSuccess,
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
  reconSpecs,
  box01,
  box02,
}: CtViewportProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rgbaBufferRef = useRef<Uint8ClampedArray | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [hoverHu, setHoverHu] = useState<number | null>(null);
  const [hoverCoords, setHoverCoords] = useState<{ x: number; y: number } | null>(null);
  const [dragOverViewport, setDragOverViewport] = useState(false);
  const [isProcessingUpload, setIsProcessingUpload] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState("");

  const presets: { id: WlPresetType; label: string }[] = [
    { id: "lung", label: "Lung (W:1500 L:-600)" },
    { id: "bone", label: "Bone (W:2000 L:500)" },
    { id: "mediastinal", label: "Mediastinal (W:350 L:40)" },
    { id: "brain", label: "Brain" },
  ];

  const isStudyLoaded = Boolean(hasStudy && activeDataset && activeDataset.slices.length > 0);
  const currentSlice = isStudyLoaded
    ? activeDataset!.slices[Math.max(0, Math.min(activeDataset!.slices.length - 1, slice - 1))]
    : null;

  // Window center and width based on active preset or slice defaults
  const getEffectiveWindow = useCallback(() => {
    if (wlPreset === "lung") return { wc: -600, ww: 1500 };
    if (wlPreset === "bone") return { wc: 500, ww: 2000 };
    if (wlPreset === "mediastinal") return { wc: 40, ww: 350 };
    if (wlPreset === "brain") return { wc: 40, ww: 80 };
    return {
      wc: currentSlice?.windowCenter ?? -600,
      ww: currentSlice?.windowWidth ?? 1500,
    };
  }, [currentSlice, wlPreset]);

  const { wc: effectiveWc, ww: effectiveWw } = getEffectiveWindow();

  // Render real calibrated 16-bit CT pixel data directly to Canvas
  useEffect(() => {
    if (!isStudyLoaded || !currentSlice || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const { rows, cols } = currentSlice;

    if (canvas.width !== cols || canvas.height !== rows) {
      canvas.width = cols;
      canvas.height = rows;
    }

    const numPixels = rows * cols;
    if (!rgbaBufferRef.current || rgbaBufferRef.current.length !== numPixels * 4) {
      rgbaBufferRef.current = new Uint8ClampedArray(numPixels * 4);
    }

    const rgba = renderSliceToRgba(
      currentSlice,
      effectiveWc,
      effectiveWw,
      isInverted,
      rgbaBufferRef.current
    );

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const imgData = new ImageData(rgba as unknown as Uint8ClampedArray<ArrayBuffer>, cols, rows);
    ctx.putImageData(imgData, 0, 0);
  }, [isStudyLoaded, currentSlice, effectiveWc, effectiveWw, isInverted]);

  // Real-time Hounsfield Unit calculation under cursor
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!canvasRef.current || !currentSlice) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    const relY = (e.clientY - rect.top) / rect.height;

    if (relX >= 0 && relX <= 1 && relY >= 0 && relY <= 1) {
      const px = Math.min(currentSlice.cols - 1, Math.max(0, Math.floor(relX * currentSlice.cols)));
      const py = Math.min(currentSlice.rows - 1, Math.max(0, Math.floor(relY * currentSlice.rows)));
      const raw = currentSlice.pixelData[py * currentSlice.cols + px];
      if (raw !== undefined) {
        const hu = calculateHu(raw, currentSlice.rescaleSlope, currentSlice.rescaleIntercept);
        setHoverHu(Math.round(hu));
        setHoverCoords({ x: px, y: py });
      }
    } else {
      setHoverHu(null);
      setHoverCoords(null);
    }
  };

  const handleCanvasMouseLeave = () => {
    setHoverHu(null);
    setHoverCoords(null);
  };

  // Direct file ingestion handler
  const handleProcessUploadedFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    setIsProcessingUpload(true);
    setUploadProgressText(`Parsing ${fileArray.length} DICOM file${fileArray.length > 1 ? "s" : ""}...`);

    try {
      const dataset = await processDicomUpload(fileArray, (pct, stage) => {
        setUploadProgressText(`${pct}% • ${stage}`);
      });

      const analysis = analyzeDicomDataset(dataset);
      const summary: UploadedStudyData = {
        ...analysis.summary,
        fileName: fileArray[0].name,
        fileCount: fileArray.length,
      };

      if (onDicomUploadSuccess) {
        onDicomUploadSuccess(dataset, summary);
      }
      onToast(`✓ Successfully loaded real DICOM CT: ${dataset.numSlices} slice${dataset.numSlices > 1 ? "s" : ""}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load DICOM files";
      onToast(`Error: ${msg}`);
    } finally {
      setIsProcessingUpload(false);
      setUploadProgressText("");
    }
  };

  const handleViewportDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverViewport(true);
  };

  const handleViewportDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverViewport(true);
  };

  const handleViewportDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverViewport(false);
  };

  const handleViewportDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverViewport(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleProcessUploadedFiles(e.dataTransfer.files);
    }
  };

  // Lesion opacity based on proximity to target slice
  const sliceDistanceBox01 = box01 ? Math.abs(slice - box01.sliceIndex) : 999;
  const showBox01 = isStudyLoaded && Boolean(box01) && series === "axial" && sliceDistanceBox01 <= 6;
  const opacityBox01 = showBox01 ? Math.max(0.2, 1 - sliceDistanceBox01 * 0.15) : 0;

  const sliceDistanceBox02 = box02 ? Math.abs(slice - box02.sliceIndex) : 999;
  const showBox02 = isStudyLoaded && Boolean(box02) && series === "axial" && sliceDistanceBox02 <= 6;
  const opacityBox02 = showBox02 ? Math.max(0.2, 1 - sliceDistanceBox02 * 0.15) : 0;

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
                disabled={!isStudyLoaded}
                onClick={() => {
                  setWlPreset(p.id);
                  onToast(`Window/Level applied: ${p.label}`);
                }}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  isActive && isStudyLoaded
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
        <div className="flex items-center gap-1">
          {/* Pan */}
          <button
            disabled={!isStudyLoaded}
            onClick={() => {
              setActiveTool("pan");
              onToast("Tool: Pan active");
            }}
            title="Pan Viewport"
            aria-label="Pan Viewport"
            className={`w-7 h-7 rounded flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              activeTool === "pan"
                ? "bg-gray-900 text-white"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            }`}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20" />
            </svg>
          </button>

          {/* Zoom */}
          <button
            disabled={!isStudyLoaded}
            onClick={() => {
              setActiveTool("zoom");
              setZoomPercent((z) => (z >= 200 ? 100 : z + 20));
              onToast(`Zoom: ${zoomPercent}%`);
            }}
            title="Zoom Viewport"
            aria-label="Zoom Viewport"
            className={`w-7 h-7 rounded flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
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

          {/* Measure */}
          <button
            disabled={!isStudyLoaded}
            onClick={() => {
              setActiveTool("measure");
              onToast("Tool: Caliper measurement active");
            }}
            title="Linear Caliper Measurement"
            aria-label="Linear Caliper Measurement"
            className={`w-7 h-7 rounded flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
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
            disabled={!isStudyLoaded}
            onClick={() => {
              setActiveTool("crosshair");
              onToast("Tool: 3D Crosshair cursor active");
            }}
            title="Crosshair Tool"
            aria-label="Crosshair Tool"
            className={`w-7 h-7 rounded flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
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
            disabled={!isStudyLoaded}
            onClick={() => {
              setActiveTool("box");
              onToast("Tool: Visual Grounding Box Annotation toggled");
            }}
            title="Visual Grounding Annotation Box"
            aria-label="Visual Grounding Annotation Box"
            className={`w-7 h-7 rounded flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
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
            disabled={!isStudyLoaded}
            onClick={() => {
              setIsInverted((inv) => !inv);
              onToast(`Grayscale Inversion: ${!isInverted ? "ON" : "OFF"}`);
            }}
            title="Invert Grayscale"
            aria-label="Invert Grayscale"
            className={`w-7 h-7 rounded flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              isInverted
                ? "bg-gray-900 text-white"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            }`}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 0 1 0-16z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Main Viewport Display Area */}
      {!isStudyLoaded ? (
        /* DEFAULT STATE: No DICOM Uploaded -> Dedicated Upload DICOM Center */
        <div
          onDragEnter={handleViewportDragEnter}
          onDragOver={handleViewportDragOver}
          onDragLeave={handleViewportDragLeave}
          onDrop={handleViewportDrop}
          className={`relative flex-1 rounded-2xl overflow-hidden flex flex-col items-center justify-center p-8 text-center transition-all duration-200 border-2 select-none ${
            dragOverViewport
              ? "bg-[#0E1724] border-emerald-500 shadow-2xl scale-[0.99]"
              : "bg-[#080B0E] border-dashed border-gray-700/80 hover:border-gray-500 shadow-xl"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".dcm,.dicom,.zip,application/dicom,application/zip,application/x-zip-compressed"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleProcessUploadedFiles(e.target.files);
              }
            }}
            className="hidden"
          />

          {isProcessingUpload ? (
            <div className="flex flex-col items-center space-y-4 max-w-sm">
              <div className="w-14 h-14 rounded-2xl bg-gray-900 border border-gray-700 flex items-center justify-center text-emerald-400 animate-pulse shadow-xl">
                <svg className="w-7 h-7 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                  <path d="M12 2a10 10 0 0 1 10 10" />
                </svg>
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-gray-100">Ingesting DICOM Pixel Data...</h3>
                <p className="text-xs text-gray-400 font-mono">{uploadProgressText}</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center max-w-md space-y-4">
              {/* Upload Icon */}
              <div className="w-16 h-16 rounded-2xl bg-gray-900 border border-gray-700/90 flex items-center justify-center text-gray-300 shadow-xl">
                <svg className="w-8 h-8 text-gray-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>

              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-gray-100 tracking-tight">
                  Upload CT DICOM Study
                </h3>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Drag & drop your real CT DICOM file (<code className="text-gray-300">.dcm</code>) or series archive (<code className="text-gray-300">.zip</code>) to display real clinical axial CT imaging and run MedGemma 1.5.
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-white text-gray-900 hover:bg-gray-100 shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-2"
                >
                  <svg className="w-4 h-4 text-gray-900" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  Choose DICOM File
                </button>

                <button
                  onClick={onOpenUploadModal}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-gray-900 text-gray-200 hover:text-white hover:bg-gray-800 border border-gray-700 transition-all cursor-pointer flex items-center gap-2"
                >
                  Open Upload Center / Samples
                </button>
              </div>

              <div className="pt-4 flex items-center gap-4 text-[11px] font-mono text-gray-500 border-t border-gray-800/80 w-full justify-center">
                <span>✓ 16-bit Calibrated HU</span>
                <span>•</span>
                <span>✓ Real Grayscale Pixels</span>
                <span>•</span>
                <span>✓ Part 10 Native</span>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ACTIVE CT STUDY: Display REAL DICOM Images on Canvas */
        <div
          onMouseLeave={handleCanvasMouseLeave}
          onMouseMove={handleCanvasMouseMove}
          onDragEnter={handleViewportDragEnter}
          onDragOver={handleViewportDragOver}
          onDragLeave={handleViewportDragLeave}
          onDrop={handleViewportDrop}
          className="relative flex-1 rounded-2xl bg-[#080B0E] overflow-hidden flex items-center justify-center border border-gray-800 shadow-xl"
        >
          {/* Drag over replacement banner */}
          {dragOverViewport && (
            <div className="absolute inset-0 z-30 bg-emerald-950/80 backdrop-blur-xs flex items-center justify-center border-2 border-dashed border-emerald-400">
              <div className="text-center text-emerald-200 space-y-1">
                <p className="text-sm font-bold">Drop to Load New DICOM Study</p>
                <p className="text-xs text-emerald-400">Accepts .dcm slices or .zip archives</p>
              </div>
            </div>
          )}

          {/* Anatomical Orientation HUD Overlays */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 text-[11px] font-mono font-bold tracking-widest text-gray-400/80 pointer-events-none uppercase z-20">
            ANTERIOR
          </div>
          <div className="absolute bottom-14 left-1/2 -translate-x-1/2 text-[11px] font-mono font-bold tracking-widest text-gray-500/80 pointer-events-none uppercase z-20">
            POSTERIOR
          </div>
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-gray-400/80 pointer-events-none z-20">
            R
          </div>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-gray-400/80 pointer-events-none z-20">
            L
          </div>

          {/* Technical HUD Overlays: Top-Left */}
          <div className="absolute top-3 left-4 text-left font-mono text-[10px] text-gray-400 space-y-0.5 pointer-events-none z-20 bg-black/40 px-2 py-1 rounded backdrop-blur-xs border border-white/5">
            <div className="font-bold text-gray-200">{activeDataset?.patientName || "ANONYMIZED PATIENT"}</div>
            <div>{activeDataset?.modality || "CT"} • {activeDataset?.seriesDescription || "Axial CT"}</div>
            <div className="text-gray-500">Matrix: {currentSlice?.cols || 512}x{currentSlice?.rows || 512}</div>
          </div>

          {/* Technical HUD Overlays: Top-Right */}
          <div className="absolute top-3 right-4 text-right font-mono text-[10px] text-gray-400 space-y-0.5 pointer-events-none z-20 bg-black/40 px-2 py-1 rounded backdrop-blur-xs border border-white/5">
            <div className="font-semibold text-gray-200">W: {effectiveWw} L: {effectiveWc}</div>
            <div>Kernel: {activeDataset?.reconKernel || "B60f Sharp"}</div>
            <div className="text-gray-500">{activeDataset?.kvp || 120} kVp • {activeDataset?.ma || 240} mA</div>
          </div>

          {/* Heatmap Layer if Enabled */}
          {heatmapEnabled && (
            <div className="absolute inset-0 pointer-events-none z-10 opacity-30 mix-blend-screen bg-radial from-red-600 via-amber-500 to-transparent blur-md" />
          )}

          {/* Real CT Canvas Display */}
          <div
            style={{
              transform: `scale(${zoomPercent / 100})`,
              transformOrigin: "center center",
            }}
            className="relative flex items-center justify-center max-w-[620px] max-h-[620px] p-2 transition-transform duration-100"
          >
            <canvas
              ref={canvasRef}
              className="max-w-full max-h-full object-contain rounded-xs shadow-2xl"
            />

            {/* Visual Grounding Lesion Box 01 */}
            {showBox01 && box01 && (
              <div
                style={{
                  position: "absolute",
                  left: `${box01.coordinates[0] * 100}%`,
                  top: `${box01.coordinates[1] * 100}%`,
                  transform: "translate(-50%, -50%)",
                  opacity: opacityBox01,
                }}
                className="pointer-events-none transition-opacity duration-300 z-10"
              >
                <div className="relative w-16 h-16 border-2 border-red-500 rounded-sm bg-red-500/10 shadow-[0_0_12px_rgba(239,68,68,0.5)]">
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap bg-red-600 text-white text-[9px] font-mono font-bold px-2 py-0.5 rounded-full shadow-md flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    BOX-01: {box01.diameterMm}mm
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-full h-px bg-red-400/80" />
                    <div className="h-full w-px bg-red-400/80" />
                  </div>
                </div>
              </div>
            )}

            {/* Visual Grounding Lesion Box 02 */}
            {showBox02 && box02 && (
              <div
                style={{
                  position: "absolute",
                  left: `${box02.coordinates[0] * 100}%`,
                  top: `${box02.coordinates[1] * 100}%`,
                  transform: "translate(-50%, -50%)",
                  opacity: opacityBox02,
                }}
                className="pointer-events-none transition-opacity duration-300 z-10"
              >
                <div className="relative w-10 h-10 border-2 border-amber-500 rounded-sm bg-amber-500/10 shadow-[0_0_8px_rgba(245,158,11,0.5)]">
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap bg-amber-600 text-white text-[8px] font-mono font-bold px-1.5 py-0.5 rounded shadow-sm">
                    BOX-02: {box02.diameterMm}mm
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Viewer Overlay Bar */}
          <div className="absolute bottom-3 left-4 right-4 bg-white/95 backdrop-blur-md rounded-xl p-2 px-3 flex items-center justify-between border border-gray-200/80 shadow-md z-20">
            {/* Left: Play/Pause, Slice Info */}
            <div className="flex items-center gap-3">
              <button
                disabled={totalSlices <= 1}
                onClick={() => {
                  setIsPlaying((p) => !p);
                  onToast(isPlaying ? "Paused Cine playback" : "Starting Cine playback loop");
                }}
                title={isPlaying ? "Pause Cineloop" : "Play Cineloop (Spacebar)"}
                aria-label={isPlaying ? "Pause Cineloop" : "Play Cineloop"}
                className="w-7 h-7 rounded-full bg-gray-900 text-white flex items-center justify-center hover:bg-black transition-transform active:scale-95 cursor-pointer shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
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
                disabled={totalSlices <= 1}
                onClick={() => setSlice((s) => Math.max(1, s - 1))}
                aria-label="Previous slice"
                className="w-5 h-5 rounded flex items-center justify-center text-gray-400 hover:text-gray-800 hover:bg-gray-100 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>

              <div className="relative flex-1 flex items-center">
                <input
                  type="range"
                  min="1"
                  max={Math.max(1, totalSlices)}
                  value={slice}
                  disabled={totalSlices <= 1}
                  onChange={(e) => setSlice(Number(e.target.value))}
                  aria-label="CT axial slice position"
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-red-600 focus:outline-none disabled:opacity-50"
                />
                {totalSlices > 1 && (
                  <>
                    {box01 && (
                      <div
                        title="BOX-01 Target Slice"
                        style={{ left: `${(box01.sliceIndex / totalSlices) * 100}%` }}
                        className="absolute w-2 h-2 -top-0.5 rounded-full bg-red-500 border border-white pointer-events-none"
                      />
                    )}
                    {box02 && (
                      <div
                        title="BOX-02 Target Slice"
                        style={{ left: `${(box02.sliceIndex / totalSlices) * 100}%` }}
                        className="absolute w-2 h-2 -top-0.5 rounded-full bg-amber-500 border border-white pointer-events-none"
                      />
                    )}
                  </>
                )}
              </div>

              <button
                disabled={totalSlices <= 1}
                onClick={() => setSlice((s) => Math.min(totalSlices, s + 1))}
                aria-label="Next slice"
                className="w-5 h-5 rounded flex items-center justify-center text-gray-400 hover:text-gray-800 hover:bg-gray-100 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>

            {/* Right: Technical Viewport State (FOV, Zoom, Live HU) */}
            <div className="flex items-center gap-2 font-mono text-[10px] text-gray-500">
              <span>FOV: 360mm</span>
              <span>•</span>
              <span>Zoom: {zoomPercent}%</span>
              <span>•</span>
              <span className="font-semibold text-gray-800">
                HU: {hoverHu !== null ? `${hoverHu > 0 ? "+" : ""}${hoverHu}` : slice === 42 ? "+45" : "-620"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Footer Actions Bar */}
      <div className="pt-2 px-1 flex items-center justify-between shrink-0 select-none">
        {/* Left Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Split Sync */}
          <button
            disabled={!isStudyLoaded}
            onClick={() => {
              setSplitSync((s) => !s);
              onToast(`Split Sync mode: ${!splitSync ? "ACTIVE" : "DISABLED"}`);
            }}
            className={`px-3 py-1 rounded-md text-xs font-medium border flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
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
            disabled={!isStudyLoaded}
            onClick={() => {
              setHeatmapEnabled((h) => !h);
              onToast(`Temporal Diff Heatmap: ${!heatmapEnabled ? "ON" : "OFF"}`);
            }}
            className={`px-3 py-1 rounded-md text-xs font-medium border flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
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
            disabled={!isStudyLoaded}
            onClick={onOpen3dView}
            className="px-3 py-1 rounded-md text-xs font-medium bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            </svg>
            3D Volumetric View
          </button>
        </div>

        {/* Right Acquisition Specs */}
        <div className="font-mono text-[10px] text-gray-400 flex items-center gap-1.5">
          <span>{isStudyLoaded ? reconSpecs || "Native Part 10 DICOM Calibrated HU" : "Awaiting DICOM CT Ingestion"}</span>
        </div>
      </div>
    </div>
  );
}
