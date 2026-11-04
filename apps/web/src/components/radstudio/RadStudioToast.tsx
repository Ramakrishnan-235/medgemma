"use client";

import React from "react";

interface RadStudioToastProps {
  message: string | null;
}

export function RadStudioToast({ message }: RadStudioToastProps) {
  if (!message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-gray-900/95 backdrop-blur-md text-white text-xs font-medium shadow-xl border border-gray-700/80 animate-in fade-in slide-in-from-bottom-2 duration-200"
    >
      <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

