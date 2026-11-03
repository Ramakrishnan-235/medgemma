"use client";

import React from "react";
import { HistogramBarData } from "./types";

interface ZAxisAttentionCardProps {
  axialSlice: number;
  onSliceChange: (slice: number) => void;
  histogramBars: HistogramBarData[];
  activeAttentionText: string;
}

export function ZAxisAttentionCard({
  axialSlice,
  onSliceChange,
  histogramBars,
  activeAttentionText,
}: ZAxisAttentionCardProps) {
  const formattedActiveSlice = String(axialSlice).padStart(3, "0");

  return (
    <div className="reveal-on-scroll wellness-card-lg bg-white/95 border border-[#E8EFE8] p-6 sm:p-8 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2.5">
            <span className="w-3 h-3 rounded-full bg-[#FFB7B2]" />
            <h2 className="text-lg font-semibold text-[#292524] tracking-tight">
              MedGemma z-axis slice sampling &amp; anomaly attention
            </h2>
            <span className="text-xs text-[#78716C]">(slices 1–160)</span>
          </div>
          <p className="font-expressive text-2xl text-[#78716C] mt-0.5">
            Click any attention bar or slide to scrub through the 3d volume
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <span className="px-4 py-1.5 rounded-full bg-[#E8EFE8] text-xs font-semibold text-[#292524]">
            Sampling density: 40% (sparse attention gate)
          </span>
        </div>
      </div>

      {/* Interactive 48-Bar Z-Axis Attention Histogram */}
      <div className="relative pt-7 pb-2 px-3 rounded-[2rem] bg-[#FDFCF8] border border-[#292524]/5">
        {/* Floating Active Indicator Pill */}
        <div className="inline-flex items-center space-x-1.5 bg-[#FFB7B2] text-[#292524] px-3.5 py-1 rounded-full text-xs font-semibold shadow-sm mb-3">
          <span>●</span>
          <span>{activeAttentionText}</span>
        </div>

        <div
          className="h-24 flex items-end gap-1 select-none cursor-pointer"
          role="region"
          aria-label="Z-axis slice attention histogram"
        >
          {histogramBars.map((bar, idx) => {
            const isCurrent = Math.abs(bar.slice - axialSlice) <= 2;
            const heightPct = Math.round(bar.score * 100);

            let bgClass = "bg-[#E8EFE8] hover:bg-[#FFB7B2]/70";
            if (isCurrent) {
              bgClass = "bg-[#292524] ring-2 ring-[#FFB7B2]";
            } else if (bar.isPeak) {
              bgClass = "bg-[#FFB7B2] hover:brightness-95";
            }

            return (
              <button
                key={`${bar.slice}-${idx}`}
                type="button"
                onClick={() => onSliceChange(bar.slice)}
                title={`Slice ${bar.slice} (${(bar.score * 100).toFixed(1)}% attention)`}
                aria-label={`Jump to slice ${bar.slice}`}
                className={`flex-1 rounded-t-full transition-all duration-200 cursor-pointer ${bgClass}`}
                style={{ height: `${heightPct}%` }}
              />
            );
          })}
        </div>
      </div>

      {/* Smooth Range Slider Scrubber */}
      <div className="space-y-2">
        <input
          type="range"
          min="1"
          max="160"
          value={axialSlice}
          onChange={(e) => onSliceChange(Number(e.target.value))}
          aria-label="Axial slice scrubber"
          className="w-full wellness-slider"
        />
        <div className="flex items-center justify-between text-xs text-[#78716C] font-medium px-1">
          <span>Slice 001 (superior dome)</span>
          <span className="text-[#292524] font-semibold bg-[#EFEDF4] px-3.5 py-1 rounded-full">
            Active position: slice {formattedActiveSlice} / 160
          </span>
          <span>Slice 160 (inferior pelvis)</span>
        </div>
      </div>
    </div>
  );
}

