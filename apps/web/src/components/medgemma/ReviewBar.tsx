"use client";

import { useShallow } from "zustand/react/shallow";
import React from "react";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { PAGES, type PageId } from "@/types/workspace";

export function ReviewBar() {
  const { page, setPage } = useWorkspaceStore(
    useShallow((state) => ({
      page: state.page,
      setPage: state.setPage,
    })),
  );

  return (
    <div className="reviewbar sticky top-0 z-30 h-10 bg-[#18181b] border-b border-[#27272a] px-5 flex items-center justify-between text-[11px] text-zinc-400 shrink-0 select-none">
      <span className="flex items-center gap-2">
        <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-white text-zinc-950 font-bold text-[11px] leading-none select-none">
          +
        </span>
        <b className="font-semibold text-white">MedGemma</b>
        <span className="dot" />
        <span className="review-note text-zinc-400">UI concept · </span>
        <span className="text-zinc-400">15 screens</span>
      </span>
      <label className="flex items-center gap-2 cursor-pointer">
        <span className="review-note text-zinc-400 text-[11px]">Preview </span>
        <select
          id="screen-picker"
          aria-label="Choose a page design"
          value={page}
          onChange={(e) => setPage(e.target.value as PageId)}
          className="bg-[#09090b] text-zinc-100 border border-[#27272a] rounded-md px-2.5 py-1 text-[11px] font-medium max-w-[210px] cursor-pointer hover:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-400 transition-colors"
        >
          {PAGES.map(([id, label], i) => (
            <option key={id} value={id} className="bg-[#18181b] text-zinc-100">
              {String(i + 1).padStart(2, "0")} / {label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
