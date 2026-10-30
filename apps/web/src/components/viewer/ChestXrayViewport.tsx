"use client";

import { useShallow } from "zustand/react/shallow";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  RenderingEngine,
  getRenderingEngine,
  Enums,
  init as csRenderInit,
  type Types,
} from "@cornerstonejs/core";
import {
  init as csToolsInit,
  ToolGroupManager,
  WindowLevelTool,
  PanTool,
  ZoomTool,
  addTool,
  Enums as csToolsEnums,
} from "@cornerstonejs/tools";
import {
  useImagingStore,
  type NormalizedBox,
  type StudyAnnotation,
  type ViewerToolMode,
} from "@/stores/useImagingStore";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

interface ChestXrayViewportProps {
  viewportId: string;
  sourceFileId: string;
  studyTitle: string;
  studyDate?: string | null;
  viewPosition?: string;
  imageUrl: string; // presigned DICOM wadouri: or normalized PNG url
  isDicom: boolean;
  imageWidth: number;
  imageHeight: number;
  annotations: StudyAnnotation[];
  onCreateManualBox?: (bboxNorm: NormalizedBox, label: string) => Promise<void>;
}

let cornerstoneInitialized = false;

async function ensureCornerstoneInitialized() {
  if (cornerstoneInitialized) return;
  await csRenderInit();
  await csToolsInit();
  addTool(WindowLevelTool);
  addTool(PanTool);
  addTool(ZoomTool);
  cornerstoneInitialized = true;
}

export default function ChestXrayViewport({
  viewportId,
  sourceFileId,
  studyTitle,
  studyDate,
  viewPosition = "UNKNOWN",
  imageUrl,
  isDicom,
  imageWidth,
  imageHeight,
  annotations,
  onCreateManualBox,
}: ChestXrayViewportProps) {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<RenderingEngine | null>(null);

  const { activeTool, showModelBoxes, syncPriorCurrent, sharedWindowRange, setSharedWindowRange, highlightedSourceId, highlightedBboxNorm } = useImagingStore(
    useShallow((state) => ({
      activeTool: state.activeTool,
      showModelBoxes: state.showModelBoxes,
      syncPriorCurrent: state.syncPriorCurrent,
      sharedWindowRange: state.sharedWindowRange,
      setSharedWindowRange: state.setSharedWindowRange,
      highlightedSourceId: state.highlightedSourceId,
      highlightedBboxNorm: state.highlightedBboxNorm,
    })),
  );

  const { sliceIndex, setSliceIndex } = useWorkspaceStore(
    useShallow((state) => ({
      sliceIndex: state.sliceIndex,
      setSliceIndex: state.setSliceIndex,
    })),
  );

  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{ x: number; y: number } | null>(null);
  const [, setCameraTick] = useState(0);

  // Initialize Cornerstone3D StackViewport
  useEffect(() => {
    let isMounted = true;
    let resizeObserver: ResizeObserver | null = null;
    const engineId = `engine_${viewportId}`;
    const toolGroupId = `tg_${viewportId}`;

    async function setupViewport() {
      await ensureCornerstoneInitialized();
      if (!isMounted || !elementRef.current) return;

      const engine = (getRenderingEngine(engineId) as RenderingEngine | undefined) || new RenderingEngine(engineId);
      engineRef.current = engine;

      engine.enableElement({
        viewportId,
        type: Enums.ViewportType.STACK,
        element: elementRef.current,
      });

      const viewport = engine.getViewport(viewportId) as Types.IStackViewport;
      const schemeUrl = isDicom ? `wadouri:${imageUrl}` : `web:${imageUrl}`;
      await viewport.setStack([schemeUrl], 0);
      viewport.render();

      let toolGroup = ToolGroupManager.getToolGroup(toolGroupId);
      if (!toolGroup) {
        toolGroup = ToolGroupManager.createToolGroup(toolGroupId)!;
        toolGroup.addTool(WindowLevelTool.toolName);
        toolGroup.addTool(PanTool.toolName);
        toolGroup.addTool(ZoomTool.toolName);
      }
      toolGroup.addViewport(viewportId, engineId);
      toolGroup.setToolActive(WindowLevelTool.toolName, {
        bindings: [{ mouseButton: csToolsEnums.MouseBindings.Primary }],
      });

      const handleCameraOrVoiModified = () => {
        setCameraTick((t: number) => t + 1);
        if (syncPriorCurrent) {
          const props = viewport.getProperties();
          if (props.voiRange) {
            setSharedWindowRange(props.voiRange);
          }
        }
      };

      elementRef.current.addEventListener(
        Enums.Events.CAMERA_MODIFIED,
        handleCameraOrVoiModified
      );
      elementRef.current.addEventListener(
        Enums.Events.VOI_MODIFIED,
        handleCameraOrVoiModified
      );

      // Safe ResizeObserver to adjust Cornerstone3D canvas dimensions
      if (elementRef.current && typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(() => {
          if (engineRef.current && elementRef.current) {
            try {
              engineRef.current.resize();
              const vp = engineRef.current.getViewport(viewportId);
              vp?.render();
            } catch {
              // Ignore resize errors during teardown
            }
          }
        });
        resizeObserver.observe(elementRef.current);
      }
    }

    setupViewport();

    return () => {
      isMounted = false;
      resizeObserver?.disconnect();
      const tg = ToolGroupManager.getToolGroup(`tg_${viewportId}`);
      if (tg) {
        ToolGroupManager.destroyToolGroup(`tg_${viewportId}`);
      }
      engineRef.current?.destroy();
    };
  }, [viewportId, imageUrl, isDicom]);

  // Synchronize Window/Level across Prior & Current viewports
  useEffect(() => {
    if (!syncPriorCurrent || !sharedWindowRange || !engineRef.current) return;
    const vp = engineRef.current.getViewport(viewportId) as Types.IStackViewport | undefined;
    if (!vp) return;
    vp.setProperties({ voiRange: sharedWindowRange });
    vp.render();
  }, [sharedWindowRange, syncPriorCurrent, viewportId]);

  // Switch active Cornerstone3D mouse tool
  useEffect(() => {
    const toolGroup = ToolGroupManager.getToolGroup(`tg_${viewportId}`);
    if (!toolGroup || activeTool === "DrawBox") return;

    const toolMap: Record<Exclude<ViewerToolMode, "DrawBox">, string> = {
      WindowLevel: WindowLevelTool.toolName,
      Pan: PanTool.toolName,
      Zoom: ZoomTool.toolName,
    };
    Object.values(toolMap).forEach((name) => toolGroup.setToolPassive(name));
    toolGroup.setToolActive(toolMap[activeTool], {
      bindings: [{ mouseButton: csToolsEnums.MouseBindings.Primary }],
    });
  }, [activeTool, viewportId]);

  // Project normalized [0..1] image coordinates -> current HTML5 canvas pixel rect
  const normBoxToCanvasRect = useCallback(
    (box: NormalizedBox | null | undefined) => {
      if (!box || typeof box.x0 !== "number") return null;
      const el = elementRef.current;
      const rect = el ? el.getBoundingClientRect() : { width: imageWidth || 896, height: imageHeight || 896 };
      const left = Math.max(0, Math.min(box.x0, 1.0)) * rect.width;
      const top = Math.max(0, Math.min(box.y0, 1.0)) * rect.height;
      const right = Math.max(0, Math.min(box.x1, 1.0)) * rect.width;
      const bottom = Math.max(0, Math.min(box.y1, 1.0)) * rect.height;
      return {
        left,
        top,
        width: Math.max(0, right - left),
        height: Math.max(0, bottom - top),
      };
    },
    [imageWidth, imageHeight]
  );

  // Manual SVG bounding-box drawing handlers
  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (activeTool !== "DrawBox") return;
    const rect = e.currentTarget.getBoundingClientRect();
    setDragStart({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setDragCurrent({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!dragStart || activeTool !== "DrawBox") return;
    const rect = e.currentTarget.getBoundingClientRect();
    setDragCurrent({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleMouseUp = async (e: React.MouseEvent<SVGSVGElement>) => {
    if (!dragStart || !dragCurrent || activeTool !== "DrawBox") return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const x0 = Math.max(0, Math.min(dragStart.x, dragCurrent.x) / rect.width);
    const y0 = Math.max(0, Math.min(dragStart.y, dragCurrent.y) / rect.height);
    const x1 = Math.min(1, Math.max(dragStart.x, dragCurrent.x) / rect.width);
    const y1 = Math.min(1, Math.max(dragStart.y, dragCurrent.y) / rect.height);
    setDragStart(null);
    setDragCurrent(null);

    if (x1 - x0 > 0.02 && y1 - y0 > 0.02 && onCreateManualBox) {
      const label = window.prompt("Anatomical / Finding Label:", "Focal Opacity");
      if (label && label.trim().length >= 2) {
        await onCreateManualBox(
          {
            x0: Number(x0.toFixed(4)),
            y0: Number(y0.toFixed(4)),
            x1: Number(x1.toFixed(4)),
            y1: Number(y1.toFixed(4)),
          },
          label.trim()
        );
      }
    }
  };

  const visibleAnnotations = annotations.filter(
    (a) =>
      a.review_state !== "rejected" &&
      (a.origin === "manual" || showModelBoxes)
  );

  const isSourceHighlighted =
    highlightedSourceId === sourceFileId ||
    (sourceFileId === "src-curr-01" && (highlightedSourceId === "current-study-002" || highlightedSourceId === "source-curr-01")) ||
    (sourceFileId === "source-prior-01" && highlightedSourceId === "prior-study-001");

  return (
    <div
      className={`relative flex flex-col w-full h-full bg-zinc-950 border rounded-lg overflow-hidden ${
        isSourceHighlighted ? "border-zinc-100 ring-1 ring-zinc-100/50" : "border-zinc-800"
      }`}
    >
      {/* Top Clinical HUD */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900/90 border-b border-zinc-800 text-xs text-zinc-200 z-10">
        <div className="flex items-center gap-2">
          <span className="font-semibold tracking-tight">{studyTitle}</span>
          <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono">
            {viewPosition}
          </span>
        </div>
        <span className="text-zinc-400 font-mono">{studyDate || "24 Oct 2026"}</span>
      </div>

      {/* Cornerstone3D Canvas + Synchronized SVG Annotation Layer */}
      <div className="relative flex-1 w-full h-full min-h-[420px] bg-black">
        <div ref={elementRef} className="w-full h-full bg-black" />

        {/* DICOM 4-Corner HUD Overlay */}
        <div className="absolute inset-0 pointer-events-none p-3 flex flex-col justify-between text-[10px] font-mono select-none z-10">
          <div className="flex justify-between">
            <div className="text-zinc-300 leading-tight">
              <div className="font-semibold">{studyTitle}</div>
              <div className="text-zinc-500">DEMO-024 · {viewPosition}</div>
            </div>
            <div className="text-right text-zinc-400 leading-tight">
              <div>{studyDate || "24 Oct 2026"}</div>
              <div className="text-zinc-500">120 kVp · Non-diagnostic</div>
            </div>
          </div>
          <div className="flex justify-between items-end">
            <div className="text-zinc-400">
              <div>W: 400 L: 40</div>
              <div className="text-zinc-500">Tool: {activeTool}</div>
            </div>
            <div className="text-right text-zinc-500 tracking-wider">
              SCHEMATIC PREVIEW
            </div>
          </div>
        </div>

        <svg
          className={`absolute inset-0 w-full h-full ${
            activeTool === "DrawBox" ? "cursor-crosshair pointer-events-auto" : "pointer-events-none"
          }`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          {visibleAnnotations.map((ann) => {
            const cRect = normBoxToCanvasRect(ann.bbox_norm);
            if (!cRect) return null;
            const isModel = ann.origin === "model_medgemma";
            const strokeColor = isModel ? "#a1a1aa" : "#ffffff";
            return (
              <g key={ann.id}>
                <rect
                  x={cRect.left}
                  y={cRect.top}
                  width={cRect.width}
                  height={cRect.height}
                  fill={isModel ? "none" : "rgba(255, 255, 255, 0.08)"}
                  stroke={strokeColor}
                  strokeWidth={2}
                  strokeDasharray={isModel ? "5,3" : undefined}
                />
                <text
                  x={cRect.left + 4}
                  y={Math.max(14, cRect.top - 6)}
                  fill={strokeColor}
                  fontSize="11"
                  fontFamily="sans-serif"
                  fontWeight="600"
                >
                  {isModel ? `[AI Draft] ${ann.anatomical_label}` : ann.anatomical_label}
                </text>
              </g>
            );
          })}

          {/* Active Citation Focus Box */}
          {isSourceHighlighted &&
            highlightedBboxNorm &&
            (() => {
              const hlRect = normBoxToCanvasRect(highlightedBboxNorm);
              if (!hlRect) return null;
              return (
                <rect
                  x={hlRect.left}
                  y={hlRect.top}
                  width={hlRect.width}
                  height={hlRect.height}
                  fill="rgba(255, 255, 255, 0.12)"
                  stroke="#ffffff"
                  strokeWidth={2.5}
                />
              );
            })()}

          {/* Live Manual Box Drag Preview */}
          {dragStart && dragCurrent && (
            <rect
              x={Math.min(dragStart.x, dragCurrent.x)}
              y={Math.min(dragStart.y, dragCurrent.y)}
              width={Math.abs(dragCurrent.x - dragStart.x)}
              height={Math.abs(dragCurrent.y - dragStart.y)}
              fill="rgba(255, 255, 255, 0.15)"
              stroke="#ffffff"
              strokeWidth={1.5}
            />
          )}
        </svg>
      </div>

      {/* Bottom Slice Slider */}
      <div className="viewerbottom">
        <span>Slice</span>
        <input
          type="range"
          min="1"
          max="240"
          value={sliceIndex}
          onChange={(e) => setSliceIndex(parseInt(e.target.value, 10))}
          aria-label="Slice position"
          style={{ flex: 1 }}
        />
        <span className="slice-value">{sliceIndex}/240</span>
        <span className="badge">{viewPosition} · Series 01</span>
      </div>
    </div>
  );
}
