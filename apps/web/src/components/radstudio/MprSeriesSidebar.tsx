"use client";

import React from "react";
import type { SeriesType, DicomSeriesDataset } from "./types";

interface MprSeriesSidebarProps {
  currentSeries: SeriesType;
  onSelectSeries: (series: SeriesType) => void;
  onOpenUploadModal?: () => void;
  onToast: (msg: string) => void;
  hasStudy?: boolean;
  activeDataset?: DicomSeriesDataset | null;
}

interface SeriesItemDef {
  id: SeriesType;
  seriesNumber: string;
  title: string;
  slicesBadge: string;
  tag: string;
  specs: string;
  isActiveDefault?: boolean;
}

export function MprSeriesSidebar({
  currentSeries,
  onSelectSeries,
  onOpenUploadModal,
  onToast,
  hasStudy = false,
  activeDataset,
}: MprSeriesSidebarProps) {
  const numSlices = activeDataset?.numSlices || 128;
  const seriesList: SeriesItemDef[] = [
    {
      id: "axial",
      seriesNumber: "Series 01",
      title: activeDataset?.seriesDescription || "Axial CT",
      slicesBadge: `${numSlices} Slices`,
      tag: "AXIAL",
      specs: `${activeDataset?.slices[0]?.sliceThickness || 1.0}mm • ${activeDataset?.reconKernel || "B60f Sharp"}`,
      isActiveDefault: true,
    },
    {
      id: "coronal",
      seriesNumber: "Series 02",
      title: "Coronal MPR",
      slicesBadge: "Scout MPR",
      tag: "CORONAL",
      specs: "Multiplanar reconstruction",
    },
    {
      id: "sagittal",
      seriesNumber: "Series 03",
      title: "Sagittal MPR",
      slicesBadge: "Sagittal MPR",
      tag: "SAGITTAL",
      specs: "Orthogonal lateral view",
    },
    {
      id: "mip",
      seriesNumber: "Series 04",
      title: "Max Intensity Proj",
      slicesBadge: "MIP 10mm",
      tag: "MIP",
      specs: "Vascular review",
    },
  ];

  return (
    <aside
      aria-label="MPR and Image Series Selection"
      className="w-56 border-r border-gray-200 bg-[#F9FAFB] flex flex-col shrink-0 select-none overflow-y-auto"
    >
      {/* Header */}
      <div className="px-3 py-3 border-b border-gray-200/80 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <svg
            className="w-4 h-4 text-gray-500"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <rect x="2" y="3" width="20" height="18" rx="2" />
            <path d="M7 3v18M17 3v18M2 12h20" />
          </svg>
          <span className="text-xs font-bold tracking-tight text-gray-800 uppercase">
            MPR & SERIES
          </span>
        </div>
        <button
          onClick={onOpenUploadModal}
          title="Upload DICOM series"
          className="text-[10px] font-semibold text-gray-700 hover:text-black bg-gray-200/70 hover:bg-gray-200 px-2 py-0.5 rounded cursor-pointer transition-colors"
        >
          + Upload
        </button>
      </div>

      {/* Cards List */}
      <div className="p-2.5 space-y-3">
        {!hasStudy ? (
          <div className="p-4 rounded-xl border border-dashed border-gray-300 bg-white/80 text-center space-y-3 shadow-2xs">
            <div className="w-10 h-10 rounded-full bg-gray-100 text-gray-500 mx-auto flex items-center justify-center">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="3" width="20" height="18" rx="2" />
                <path d="M7 3v18M17 3v18M2 12h20" />
              </svg>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-gray-900">No Series Loaded</p>
              <p className="text-[11px] text-gray-500 leading-tight">
                Upload a DICOM CT study to view Axial, Coronal, Sagittal & MIP reconstructions.
              </p>
            </div>
            <button
              onClick={onOpenUploadModal}
              className="w-full py-1.5 px-2 bg-gray-900 hover:bg-black text-white text-xs font-semibold rounded-lg shadow-xs transition-all cursor-pointer"
            >
              + Upload DICOM
            </button>
          </div>
        ) : (
          seriesList.map((item) => {
          const isActive = currentSeries === item.id;
          return (
            <div
              key={item.id}
              onClick={() => {
                onSelectSeries(item.id);
                onToast(`Switched viewport to ${item.seriesNumber}: ${item.title}`);
              }}
              className={`group p-2 rounded-xl transition-all cursor-pointer border ${
                isActive
                  ? "bg-white border-gray-300 shadow-sm ring-1 ring-gray-900/5"
                  : "bg-white/60 hover:bg-white border-gray-200/60 hover:border-gray-300"
              }`}
            >
              {/* Thumbnail Container */}
              <div className="relative w-full h-24 rounded-lg bg-[#0C1014] overflow-hidden flex items-center justify-center border border-gray-800/80 shadow-inner">
                {/* Active Badge (top-left) */}
                {isActive && (
                  <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-gray-800 text-gray-100 uppercase tracking-wider border border-gray-700/60 shadow-xs">
                    ACTIVE
                  </span>
                )}

                {/* Slices count (bottom-right) */}
                <span className="absolute bottom-1 right-1.5 px-1.5 py-0.5 rounded text-[9px] font-mono text-gray-300 bg-black/70 backdrop-blur-xs">
                  {item.slicesBadge}
                </span>

                {/* Vector Thumbnail Preview */}
                {item.id === "axial" && (
                  <svg className="w-20 h-20 opacity-80" viewBox="0 0 100 100">
                    <ellipse
                      cx="50"
                      cy="50"
                      rx="42"
                      ry="34"
                      fill="none"
                      stroke="#273544"
                      strokeWidth="2.5"
                    />
                    <ellipse
                      cx="33"
                      cy="48"
                      rx="14"
                      ry="22"
                      fill="#131C24"
                      stroke="#334758"
                      strokeWidth="1.2"
                    />
                    <ellipse
                      cx="67"
                      cy="48"
                      rx="14"
                      ry="22"
                      fill="#131C24"
                      stroke="#334758"
                      strokeWidth="1.2"
                    />
                    {/* Spine */}
                    <circle cx="50" cy="74" r="5" fill="#4B5563" />
                    {/* Red nodule marker */}
                    <circle
                      cx="68"
                      cy="40"
                      r="4"
                      fill="#EF4444"
                      className="animate-pulse"
                    />
                  </svg>
                )}

                {item.id === "coronal" && (
                  <svg className="w-20 h-20 opacity-80" viewBox="0 0 100 100">
                    <path
                      d="M20 25 Q50 15 80 25 Q85 85 50 85 Q15 85 20 25"
                      fill="none"
                      stroke="#273544"
                      strokeWidth="2"
                    />
                    <ellipse
                      cx="35"
                      cy="48"
                      rx="12"
                      ry="20"
                      fill="#131C24"
                      stroke="#334758"
                      strokeWidth="1.2"
                    />
                    <ellipse
                      cx="65"
                      cy="48"
                      rx="12"
                      ry="20"
                      fill="#131C24"
                      stroke="#334758"
                      strokeWidth="1.2"
                    />
                    {/* Red lesion marker */}
                    <circle
                      cx="66"
                      cy="38"
                      r="3.5"
                      fill="#EF4444"
                    />
                  </svg>
                )}

                {item.id === "sagittal" && (
                  <svg className="w-20 h-20 opacity-80" viewBox="0 0 100 100">
                    <path
                      d="M25 30 C30 15, 70 15, 75 35 C80 60, 65 80, 45 80 C25 80, 20 55, 25 30 Z"
                      fill="#131C24"
                      stroke="#273544"
                      strokeWidth="2"
                    />
                    <circle cx="55" cy="42" r="3.5" fill="#EF4444" />
                  </svg>
                )}

                {item.id === "mip" && (
                  <svg className="w-20 h-20 opacity-80" viewBox="0 0 100 100">
                    <path
                      d="M30 65 Q45 40 50 25 Q55 40 70 65"
                      fill="none"
                      stroke="#64748B"
                      strokeWidth="2.5"
                    />
                    <circle cx="65" cy="55" r="5" fill="#F59E0B" />
                  </svg>
                )}
              </div>

              {/* Title & Specs */}
              <div className="mt-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-gray-900 group-hover:text-black">
                    {item.seriesNumber}: {item.title}
                  </span>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-mono">
                    {item.tag}
                  </span>
                </div>
                <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-1">
                  {item.specs}
                </p>
              </div>
            </div>
          );
        }))}
      </div>
    </aside>
  );
}

