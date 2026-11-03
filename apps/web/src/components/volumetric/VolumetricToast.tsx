"use client";

import React from "react";

interface VolumetricToastProps {
  message: string | null;
}

export function VolumetricToast({ message }: VolumetricToastProps) {
  if (!message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 right-6 z-50 flex items-center space-x-2.5 bg-[#292524] text-[#FDFCF8] px-5 py-3 rounded-full shadow-lg text-xs font-medium animate-in fade-in slide-in-from-bottom-2 duration-200"
    >
      <span className="w-2.5 h-2.5 rounded-full bg-[#FFB7B2]" />
      <span>{message}</span>
    </div>
  );
}

