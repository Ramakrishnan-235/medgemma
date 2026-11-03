"use client";

import React from "react";
import { parseBoundingBox1000 } from "./api";
import { VisualGroundingAnnotation } from "./types";

interface VisualGroundingOverlayProps {
  annotations: VisualGroundingAnnotation[];
  width: number;
  height: number;
  selectedId?: string | null;
  onSelect?: (anno: VisualGroundingAnnotation) => void;
}

export function VisualGroundingOverlay({
  annotations,
  width,
  height,
  selectedId,
  onSelect,
}: VisualGroundingOverlayProps) {
  if (!annotations || annotations.length === 0) return null;

  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden"
      style={{ width, height }}
      aria-label="Visual Grounding Annotations"
    >
      <svg
        width={width}
        height={height}
        className="w-full h-full"
        style={{ position: "absolute", top: 0, left: 0 }}
      >
        <defs>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {annotations.map((anno) => {
          if (!anno.box_1000) return null;

          const { left, top, width: boxWidth, height: boxHeight } = parseBoundingBox1000(
            anno.box_1000,
            width,
            height
          );
          const isSelected = selectedId === anno.id;
          const isLesion = anno.label.toLowerCase().includes("lesion") || anno.label.toLowerCase().includes("nodule");

          // Styling colors: Lesion = Coral/Peach, Reference Anatomy = Ice Blue
          const strokeColor = isLesion ? "#FFB7B2" : "#88CCF1";
          const fillColor = isLesion ? "rgba(255, 183, 178, 0.18)" : "rgba(136, 204, 241, 0.12)";
          const pillWidth = Math.min(220, Math.max(110, anno.label.length * 6.8 + 52));

          return (
            <g
              key={anno.id}
              className="pointer-events-auto cursor-pointer transition-opacity duration-200"
              onClick={() => onSelect?.(anno)}
            >
              {/* Outer Bounding Box */}
              <rect
                x={left}
                y={top}
                width={boxWidth}
                height={boxHeight}
                rx={4}
                ry={4}
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={isSelected ? 2.5 : 1.75}
                strokeDasharray={isSelected ? "none" : "4 2"}
                filter="url(#glow)"
              />

              {/* Corner crosshairs for precision medical visual grounding */}
              <line x1={left} y1={top} x2={left + 8} y2={top} stroke={strokeColor} strokeWidth={2.5} />
              <line x1={left} y1={top} x2={left} y2={top + 8} stroke={strokeColor} strokeWidth={2.5} />
              <line x1={left + boxWidth} y1={top} x2={left + boxWidth - 8} y2={top} stroke={strokeColor} strokeWidth={2.5} />
              <line x1={left + boxWidth} y1={top} x2={left + boxWidth} y2={top + 8} stroke={strokeColor} strokeWidth={2.5} />

              {/* Label Pill */}
              <g transform={`translate(${left}, ${Math.max(16, top - 6)})`}>
                <rect
                  x={0}
                  y={-14}
                  width={pillWidth}
                  height={18}
                  rx={3}
                  fill="#09090b"
                  stroke={strokeColor}
                  strokeWidth={1}
                />
                <text
                  x={6}
                  y={-2}
                  fill="#f4f4f5"
                  fontSize={10}
                  fontFamily="system-ui, sans-serif"
                  fontWeight="600"
                >
                  {anno.label.length > 22 ? `${anno.label.slice(0, 20)}...` : anno.label}
                </text>
                <text
                  x={pillWidth - 6}
                  y={-2}
                  textAnchor="end"
                  fill={isLesion ? "#FFB7B2" : "#88CCF1"}
                  fontSize={9}
                  fontFamily="monospace"
                  fontWeight="700"
                >
                  {Math.round(anno.confidence * 100)}%
                </text>
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

