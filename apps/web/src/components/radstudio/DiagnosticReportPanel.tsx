"use client";

import React from "react";

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
}

export function DiagnosticReportPanel({
  expandedSections,
  onToggleSection,
  onJumpBox01,
  onJumpBox02,
  currentSlice,
  hasStudy = false,
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
                A <strong>14.2 mm spiculated solid pulmonary nodule</strong> is
                identified within the apical segment of the right upper lobe (
                <button
                  onClick={onJumpBox01}
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium font-mono border transition-all cursor-pointer ${
                    currentSlice === 42
                      ? "bg-red-600 text-white border-red-700 shadow-2xs scale-105"
                      : "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  Slice 42 • BOX-01
                </button>
                ). Demonstrates internal ground-glass halo and peripheral micro-spiculation.
                Stable <strong>6.5 mm subpleural nodule</strong> in the left lower lobe (
                <button
                  onClick={onJumpBox02}
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium font-mono border transition-all cursor-pointer mx-1 ${
                    currentSlice === 65
                      ? "bg-amber-600 text-white border-amber-700 shadow-2xs scale-105"
                      : "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  Slice 65 • BOX-02
                </button>
                ). Airways are patent without evidence of endobronchial lesion. No pneumothorax.
                <span className="inline-block w-1.5 h-3.5 bg-red-600 ml-1 animate-pulse align-middle" />
              </p>
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
                No mediastinal or hilar lymphadenopathy. Subcarinal and
                paratracheal stations appear morphologically normal. Cardiac
                silhouette is normal in size without pericardial effusion.
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
                No pleural effusion. Thin visceral pleural tag adjacent to the
                right upper lobe lesion without frank chest wall erosion or rib
                osteolysis.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* OVERALL CLINICAL IMPRESSION Callout */}
      <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-xs text-gray-800 leading-relaxed space-y-1">
        <div className="flex items-center gap-1.5 font-bold text-[11px] text-gray-900 tracking-wide uppercase font-mono">
          <span className="w-2 h-2 rounded-full bg-red-600" />
          OVERALL CLINICAL IMPRESSION
        </div>
        <p className="text-[11px] text-gray-700">
          <strong>1. 14.2 mm spiculated RUL pulmonary nodule</strong> with
          interval volumetric expansion from prior examination (Volume doubling
          time: 118 days). Highly suspicious for primary bronchogenic carcinoma
          (Lung-RADS 4B). Tissue biopsy or PET-CT staging correlation is
          recommended.
        </p>
      </div>
    </div>
  );
}

