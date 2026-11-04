"use client";

import React from "react";
import type { ModalityType } from "./types";

interface RadStudioHeaderProps {
  modality: ModalityType;
  setModality: (m: ModalityType) => void;
  onToast: (msg: string) => void;
}

export function RadStudioHeader({
  modality,
  setModality,
  onToast,
}: RadStudioHeaderProps) {
  return (
    <header className="h-14 border-b border-gray-200 bg-white px-4 flex items-center justify-between shrink-0 select-none">
      {/* Left: Branding & Station ID */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-800 bg-gray-50 shadow-xs">
          <svg
            className="w-4 h-4 text-gray-900"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5 leading-none">
            <span className="font-semibold text-sm tracking-tight text-gray-900">
              MedGemma
            </span>
            <span className="text-sm font-normal text-gray-500">
              RadStudio
            </span>
          </div>
          <span className="text-[10px] tracking-wider font-mono text-gray-400 uppercase mt-0.5">
            STATION-04 • HRCT
          </span>
        </div>
      </div>

      {/* Center: Modality Pill Switcher */}
      <div
        className="flex items-center bg-gray-100 p-0.5 rounded-full border border-gray-200/80"
        role="tablist"
        aria-label="Imaging Modality"
      >
        {(["CT", "MRI", "WSI"] as ModalityType[]).map((mode) => {
          const isActive = modality === mode;
          return (
            <button
              key={mode}
              role="tab"
              aria-selected={isActive}
              onClick={() => {
                setModality(mode);
                onToast(`Switched active workspace modality to ${mode}`);
              }}
              className={`px-4 py-1 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                isActive
                  ? "bg-gray-900 text-white shadow-xs"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              {mode}
            </button>
          );
        })}
      </div>

      {/* Right: Quick Settings & User Info */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-medium font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          PACSLINK ONLINE
        </div>
        <button
          onClick={() => onToast("Station preferences: Workstation 4.4")}
          aria-label="Workstation options"
          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
      </div>
    </header>
  );
}

