"use client";

import React, { useState } from "react";

interface RadStudioDockProps {
  onSelectPane?: (pane: string) => void;
  onToast: (msg: string) => void;
}

export function RadStudioDock({ onSelectPane, onToast }: RadStudioDockProps) {
  const [activeItem, setActiveItem] = useState("series");

  const items = [
    {
      id: "series",
      label: "MPR & Series Viewports",
      icon: (
        <svg
          className="w-5 h-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      ),
    },
    {
      id: "lab",
      label: "Biopsy & Pathology Correlates",
      icon: (
        <svg
          className="w-5 h-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path d="M6 18h12M10 2v4m4-4v4M9 6h6a2 2 0 012 2v10a2 2 0 01-2 2H9a2 2 0 01-2-2V8a2 2 0 012-2z" />
        </svg>
      ),
    },
    {
      id: "genomics",
      label: "EGFR/KRAS Biomarkers",
      icon: (
        <svg
          className="w-5 h-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path d="M2 15c6.667-6 13.333 0 20-6M2 9c6.667 6 13.333 0 20 6" />
          <path d="M7 10v4M12 8v8M17 10v4" />
        </svg>
      ),
    },
    {
      id: "ai",
      label: "MedGemma 1.5 Intelligence",
      icon: (
        <svg
          className="w-5 h-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-2.04z" />
          <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-2.04z" />
        </svg>
      ),
    },
    {
      id: "report",
      label: "Structured Radiology Report",
      icon: (
        <svg
          className="w-5 h-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <line x1="10" y1="9" x2="8" y2="9" />
        </svg>
      ),
    },
    {
      id: "settings",
      label: "DICOM Node Settings",
      icon: (
        <svg
          className="w-5 h-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
        </svg>
      ),
    },
  ];

  return (
    <nav
      aria-label="Workstation Navigation"
      className="w-12 border-r border-gray-200 bg-white flex flex-col items-center py-3 justify-between shrink-0 select-none z-20"
    >
      <div className="flex flex-col items-center gap-1.5 w-full">
        {items.map((item, idx) => {
          const isActive = activeItem === item.id;
          return (
            <React.Fragment key={item.id}>
              {idx === 1 && (
                <div className="w-6 h-px bg-gray-200 my-1" aria-hidden="true" />
              )}
              <button
                onClick={() => {
                  setActiveItem(item.id);
                  onSelectPane?.(item.id);
                  onToast(`Active dock: ${item.label}`);
                }}
                title={item.label}
                aria-label={item.label}
                className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all cursor-pointer relative ${
                  isActive
                    ? "bg-gray-100 text-gray-900 font-semibold"
                    : "text-gray-400 hover:text-gray-700 hover:bg-gray-50"
                }`}
              >
                {item.icon}
                {isActive && (
                  <span className="absolute left-0 top-2 bottom-2 w-0.5 bg-gray-900 rounded-r" />
                )}
              </button>
            </React.Fragment>
          );
        })}
      </div>

      {/* Bottom Profile / Alert Indicator */}
      <div className="flex flex-col items-center gap-2">
        <button
          onClick={() => onToast("System Status: Low Latency GPU Pipeline Active")}
          className="relative w-8 h-8 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-600 hover:border-gray-400 transition-colors"
          aria-label="User status"
        >
          <span className="text-[11px] font-medium">DR</span>
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
        </button>
      </div>
    </nav>
  );
}

