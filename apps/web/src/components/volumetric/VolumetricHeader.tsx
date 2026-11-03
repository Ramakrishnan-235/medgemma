"use client";

import React from "react";
import { ClusterStatus } from "./types";

interface VolumetricHeaderProps {
  clusterStatus?: ClusterStatus;
  onNewCase: () => void;
  onReplayReveal: () => void;
}

export function VolumetricHeader({
  clusterStatus,
  onNewCase,
  onReplayReveal,
}: VolumetricHeaderProps) {
  const isLive = clusterStatus?.is_live_backend;
  const onlinePct = clusterStatus?.cluster_online_percent ?? 99.8;
  const sampledCount = clusterStatus?.sampled_slices_count ?? 64;
  const contextWindow = clusterStatus?.token_context_window ?? "128k";

  return (
    <header className="reveal-on-scroll wellness-card bg-white/85 backdrop-blur-md border border-[#E8EFE8] px-6 py-4 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center space-x-4">
        <div className="w-11 h-11 rounded-[1.25rem] bg-[#E8EFE8] flex items-center justify-center border border-[#292524]/10 shadow-sm">
          <svg
            className="w-6 h-6 text-[#292524]"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9"
            />
          </svg>
        </div>
        <div>
          <div className="flex items-center space-x-2 text-xs text-[#78716C] font-medium">
            <span>Workspace</span>
            <span>•</span>
            <span>Ai diagnostics</span>
            <span>•</span>
            <span className="text-[#292524] font-semibold">
              Volumetric overview
            </span>
          </div>
          <p className="text-sm font-semibold text-[#292524] tracking-tight">
            MedGemma 1.5 clinical studio
          </p>
        </div>
      </div>

      {/* Center Command & Cluster Status */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center space-x-2 bg-[#E8EFE8]/70 px-4 py-2 rounded-full text-xs text-[#292524] border border-[#292524]/5">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              isLive ? "bg-emerald-600 animate-pulse" : "bg-emerald-500"
            }`}
          />
          <span className="font-medium">Cluster {onlinePct}% online</span>
          <span className="text-[#78716C]">•</span>
          <span className="text-[#78716C]">
            {sampledCount} slices sampled ({contextWindow} context)
          </span>
          <span className="text-[#78716C]">•</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
              isLive
                ? "bg-emerald-100 text-emerald-800"
                : "bg-amber-100 text-amber-800"
            }`}
          >
            {isLive ? "FastAPI Live" : "FastAPI Proxy"}
          </span>
        </div>

        <button
          onClick={onReplayReveal}
          type="button"
          className="px-4 py-2 rounded-full bg-[#EFEDF4] hover:bg-[#FFB7B2]/40 text-xs font-medium text-[#292524] transition cursor-pointer"
        >
          Replay scroll reveal
        </button>

        <button
          onClick={onNewCase}
          type="button"
          className="px-5 py-2.5 rounded-full bg-[#FFB7B2] hover:brightness-95 text-[#292524] font-semibold text-xs transition shadow-sm flex items-center space-x-1.5 cursor-pointer"
        >
          <span>+ New clinical case</span>
        </button>
      </div>
    </header>
  );
}

