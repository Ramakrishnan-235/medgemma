"use client";

import React from "react";
import type { DiagnosticAssessmentData } from "./types";

interface DiagnosticAssessmentPanelProps {
  data: DiagnosticAssessmentData;
  onOpenFhirModal: () => void;
  onSyncEhr: () => void;
  ehrSyncStatus: "idle" | "syncing" | "synced";
  onToast: (msg: string) => void;
}

export function DiagnosticAssessmentPanel({
  data,
  onOpenFhirModal,
  onSyncEhr,
  ehrSyncStatus,
  onToast,
}: DiagnosticAssessmentPanelProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200/90 p-3.5 shadow-2xs space-y-3 select-none">
      {/* Header */}
      <div className="flex items-center justify-between pb-1">
        <h2 className="text-xs font-bold text-gray-900 tracking-tight">
          Diagnostic Assessment
        </h2>
        <span className="text-[10px] font-mono text-gray-400 font-medium">
          {data.accessionNumber} • {data.protocol}
        </span>
      </div>

      {/* Badges Row */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {/* Lung-RADS 4B */}
        <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-100/90 text-red-800 text-[11px] font-semibold border border-red-200/80">
          <svg
            className="w-3.5 h-3.5 text-red-600 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          {data.lungRadsCurrent}
        </div>

        {/* Prior 2024 */}
        <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 text-[11px] font-medium border border-amber-200/80">
          <svg
            className="w-3.5 h-3.5 text-amber-600 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          {data.lungRadsPrior}
        </div>

        {/* Nodes Benign */}
        <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 text-[11px] font-medium border border-gray-200">
          <svg
            className="w-3.5 h-3.5 text-emerald-600 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {data.nodesStatus}
        </div>
      </div>

      {/* Malignancy Probability */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-xs font-semibold text-gray-800">
            <span>Malignancy Probability</span>
            <button
              onClick={() =>
                onToast("Ensemble model: MedGemma 1.5 Multimodal 3D Vision-Language Transformer")
              }
              title="Model Information"
              className="text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            </button>
          </div>
          <span className="text-base font-bold text-red-600 tracking-tight">
            {data.malignancyProbability}%
          </span>
        </div>

        {/* Gradient Bar with Intervention Threshold Marker */}
        <div className="relative w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
          {/* Filled gradient */}
          <div
            style={{ width: `${data.malignancyProbability}%` }}
            className="h-full rounded-full bg-gradient-to-r from-red-400 via-red-500 to-red-700 shadow-xs transition-all duration-500"
          />
        </div>

        {/* Bar Subtext: Threshold on left, AUC on right */}
        <div className="flex items-center justify-between text-[10px] text-gray-400 font-mono">
          <span>Threshold for Intervention = {data.thresholdIntervention}%</span>
          <span>MedGemma AUC: {data.aucScore}</span>
        </div>
      </div>

      {/* QUANTITATIVE VOLUMETRICS */}
      <div className="space-y-2 pt-1 border-t border-gray-100">
        <span className="text-[10px] font-bold tracking-wider text-gray-400 uppercase font-mono">
          QUANTITATIVE VOLUMETRICS
        </span>

        {/* 3 Metric Pills */}
        <div className="grid grid-cols-3 gap-2">
          {/* Volume */}
          <div className="px-2.5 py-1.5 rounded-lg bg-gray-50 border border-gray-200/70 flex flex-col">
            <span className="text-[10px] text-gray-400">Volume</span>
            <span className="text-xs font-semibold text-gray-900 mt-0.5">
              {data.volumeCm3} cm³
            </span>
          </div>

          {/* Density */}
          <div className="px-2.5 py-1.5 rounded-lg bg-gray-50 border border-gray-200/70 flex flex-col">
            <span className="text-[10px] text-gray-400">Density</span>
            <span className="text-xs font-semibold text-gray-900 mt-0.5">
              +{data.densityHu} HU
            </span>
          </div>

          {/* Max 2D */}
          <div className="px-2.5 py-1.5 rounded-lg bg-gray-50 border border-gray-200/70 flex flex-col">
            <span className="text-[10px] text-gray-400">Max 2D</span>
            <span className="text-xs font-semibold text-gray-900 mt-0.5">
              {data.max2dMm} mm
            </span>
          </div>
        </div>

        {/* Site and Doubling Time Row */}
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <div className="text-[11px] font-medium text-gray-700">
            <span className="text-gray-400 text-[10px]">Site: </span>
            {data.site}
          </div>

          {/* Vol Doubling Time (VDT) Warning Pill */}
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-50 text-red-800 text-[10px] font-medium border border-red-200/70">
            <svg
              className="w-3 h-3 text-red-600 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            <span>
              Vol Doubling Time (VDT): <strong>{data.vdtDays} Days</strong> ({data.riskExpansionLabel})
            </span>
          </div>
        </div>
      </div>

      {/* FHIR US Core & Sync Row */}
      <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-gray-600">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>FHIR US Core ready</span>
        </div>

        <div className="flex items-center gap-2">
          {/* View RAW FHIR Button */}
          <button
            onClick={onOpenFhirModal}
            className="px-2.5 py-1 rounded-full text-[11px] font-medium text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer"
          >
            &lt;View RAW FHIR&gt;
          </button>

          {/* Sync to EHR Button */}
          <button
            onClick={onSyncEhr}
            disabled={ehrSyncStatus === "syncing"}
            className="px-3 py-1 rounded-full text-[11px] font-semibold bg-gray-900 hover:bg-black text-white flex items-center gap-1.5 transition-all shadow-xs active:scale-95 cursor-pointer disabled:opacity-60"
          >
            <svg
              className={`w-3.5 h-3.5 ${
                ehrSyncStatus === "syncing" ? "animate-spin text-amber-300" : ""
              }`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            {ehrSyncStatus === "syncing"
              ? "Syncing..."
              : ehrSyncStatus === "synced"
              ? "Synced ✓"
              : "Sync to EHR"}
          </button>
        </div>
      </div>
    </div>
  );
}

