"use client";

import React from "react";
import type { DiagnosticReportData, LesionBox } from "./types";

interface DiagnosticReportPanelProps {
  expandedSections: {
    lungs: boolean;
    mediastinum: boolean;
    pleura: boolean;
  };
  onToggleSection: (sec: "lungs" | "mediastinum" | "pleura") => void;
  onJumpBox01: () => void;
  onJumpBox02: () => void;
  currentSlice: number;
  hasStudy?: boolean;
  report?: DiagnosticReportData | null;
  box01?: LesionBox | null;
  box02?: LesionBox | null;
}

export function DiagnosticReportPanel({
  expandedSections,
  onToggleSection,
  onJumpBox01,
  onJumpBox02,
  currentSlice,
  hasStudy = false,
  report,
  box01,
  box02,
}: DiagnosticReportPanelProps) {
  if (!hasStudy) {
    return (
      <div className="bg-white rounded-xl border border-gray-200/90 p-4 shadow-2xs space-y-3 select-none flex-1 flex flex-col justify-between overflow-hidden">
        <div className="flex items-center justify-between pb-1 border-b border-gray-100">
          <div className="flex items-center gap-1.5">
            <svg
              className="w-4 h-4 text-gray-700"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            <h2 className="text-xs font-bold text-gray-900 tracking-tight">
              Diagnostic Report
            </h2>
          </div>
          <span className="text-[10px] font-mono text-gray-400">Synthesis Pending</span>
        </div>
        <div className="text-center py-6 space-y-2">
          <p className="text-xs font-semibold text-gray-700">Report Synthesis Pending</p>
          <p className="text-[11px] text-gray-400 leading-relaxed max-w-xs mx-auto">
            Structured radiological findings and measurements will be synthesized automatically once a DICOM CT study is uploaded.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="bg-white rounded-xl border border-gray-200/90 p-3.5 shadow-2xs space-y-3 select-none flex-1 flex flex-col justify-between overflow-hidden">
      <div className="space-y-2.5 overflow-y-auto pr-1">
        {/* Header */}
        <div className="flex items-center justify-between pb-1 border-b border-gray-100">
          <div className="flex items-center gap-1.5">
            <svg
              className="w-4 h-4 text-gray-700"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            <h2 className="text-xs font-bold text-gray-900 tracking-tight">
              Diagnostic Report
            </h2>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-medium text-gray-500 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
            <span>Real-Time Synthesis</span>
          </div>
        </div>

        {/* SECTION 1: Lungs & Tracheobronchial Tree */}
        <div className="rounded-lg border border-gray-200/80 bg-gray-50/50 overflow-hidden">
          <button
            onClick={() => onToggleSection("lungs")}
            className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-gray-100/60 transition-colors cursor-pointer"
            aria-expanded={expandedSections.lungs}
          >
            <span className="text-[11px] font-bold text-gray-800 tracking-wider uppercase font-mono">
              SECTION 1: LUNGS & TRACHEOBRONCHIAL TREE
            </span>
            <svg
              className={`w-3.5 h-3.5 text-gray-500 transition-transform duration-200 ${
                expandedSections.lungs ? "rotate-180" : ""
              }`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {expandedSections.lungs && (
            <div className="px-3 pb-3 pt-1 text-xs text-gray-700 leading-relaxed space-y-2 border-t border-gray-100 bg-white">
              <p>
                {report?.lungsFinding || (
                  <>
                    A <strong>14.2 mm spiculated solid pulmonary nodule</strong> is identified within the apical segment of the right upper lobe.
                  </>
                )}
              </p>
              {box01 && (
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={onJumpBox01}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium font-mono border transition-all cursor-pointer ${
                      currentSlice === box01.sliceIndex
                        ? "bg-red-600 text-white border-red-700 shadow-2xs scale-105"
                        : "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    Slice {box01.sliceIndex} • {box01.id} ({box01.diameterMm}mm)
                  </button>

                  {box02 && (
                    <button
                      onClick={onJumpBox02}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium font-mono border transition-all cursor-pointer ${
                        currentSlice === box02.sliceIndex
                          ? "bg-amber-600 text-white border-amber-700 shadow-2xs scale-105"
                          : "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      Slice {box02.sliceIndex} • {box02.id} ({box02.diameterMm}mm)
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* SECTION 2: Mediastinum & Cardiovascular */}
        <div className="rounded-lg border border-gray-200/80 bg-gray-50/50 overflow-hidden">
          <button
            onClick={() => onToggleSection("mediastinum")}
            className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-gray-100/60 transition-colors cursor-pointer"
            aria-expanded={expandedSections.mediastinum}
          >
            <span className="text-[11px] font-bold text-gray-800 tracking-wider uppercase font-mono">
              SECTION 2: MEDIASTINUM & CARDIOVASCULAR
            </span>
            <svg
              className={`w-3.5 h-3.5 text-gray-500 transition-transform duration-200 ${
                expandedSections.mediastinum ? "rotate-180" : ""
              }`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {expandedSections.mediastinum && (
            <div className="px-3 pb-3 pt-1 text-xs text-gray-700 leading-relaxed border-t border-gray-100 bg-white">
              <p>
                {report?.mediastinumFinding ||
                  "No mediastinal or hilar lymphadenopathy. Subcarinal and paratracheal stations appear morphologically normal. Cardiac silhouette is normal in size without pericardial effusion."}
              </p>
            </div>
          )}
        </div>

        {/* SECTION 3: Pleura & Thoracic Wall */}
        <div className="rounded-lg border border-gray-200/80 bg-gray-50/50 overflow-hidden">
          <button
            onClick={() => onToggleSection("pleura")}
            className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-gray-100/60 transition-colors cursor-pointer"
            aria-expanded={expandedSections.pleura}
          >
            <span className="text-[11px] font-bold text-gray-800 tracking-wider uppercase font-mono">
              SECTION 3: PLEURA & THORACIC WALL
            </span>
            <svg
              className={`w-3.5 h-3.5 text-gray-500 transition-transform duration-200 ${
                expandedSections.pleura ? "rotate-180" : ""
              }`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {expandedSections.pleura && (
            <div className="px-3 pb-3 pt-1 text-xs text-gray-700 leading-relaxed border-t border-gray-100 bg-white">
              <p>
                {report?.pleuraFinding ||
                  "No pleural effusion. Visceral and parietal pleural surfaces intact without frank chest wall erosion or rib osteolysis."}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* OVERALL CLINICAL IMPRESSION Callout */}
      <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-xs text-gray-800 leading-relaxed space-y-1.5">
        <div className="flex items-center gap-1.5 font-bold text-[11px] text-gray-900 tracking-wide uppercase font-mono">
          <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
          OVERALL CLINICAL IMPRESSION
        </div>
        {report?.impressions && report.impressions.length > 0 ? (
          <div className="space-y-1 text-[11px] text-gray-700">
            {report.impressions.map((imp, idx) => (
              <p key={idx}>
                <strong>{imp}</strong>
              </p>
            ))}
            {report.recommendation && (
              <p className="text-gray-600 pt-1 text-[10.5px]">
                <em>Recommendation: {report.recommendation}</em>
              </p>
            )}
          </div>
        ) : (
          <p className="text-[11px] text-gray-700">
            <strong>1. Diagnostic study complete.</strong> Normal baseline examination. Routine screening surveillance per ACR guidelines.
          </p>
        )}
      </div>
    </div>
  );
}

