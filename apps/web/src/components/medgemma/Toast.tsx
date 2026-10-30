"use client";

import React from "react";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

export function Toast() {
  const toastMessage = useWorkspaceStore((state) => state.toastMessage);
  const showToast = useWorkspaceStore((state) => state.showToast);

  return (
    <div
      id="toast-region"
      aria-live="polite"
      aria-atomic="true"
      className="fixed right-6 bottom-[72px] sm:bottom-6 z-50 pointer-events-none flex flex-col items-end gap-2 max-sm:left-4 max-sm:right-4"
    >
      {toastMessage && (
        <div
          className="toast pointer-events-auto max-w-[340px] max-sm:max-w-none w-full sm:w-auto px-[18px] py-[14px] bg-[#18181b] border border-[#3f3f46] text-[#f4f4f5] rounded-[9px] text-[12px] shadow-2xl flex items-center justify-between gap-3 cursor-pointer transition-all duration-200 animate-in fade-in slide-in-from-bottom-2"
          role="status"
          onClick={() => showToast("")}
          title="Click to dismiss"
        >
          <span>{toastMessage}</span>
          <span className="text-[#71717a] text-[10px] hover:text-[#f4f4f5] ml-2 select-none" aria-hidden="true">
            ✕
          </span>
        </div>
      )}
    </div>
  );
}
