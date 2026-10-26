"use client";

import React from "react";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

export function Toast() {
  const { toastMessage } = useWorkspaceStore();

  if (!toastMessage) return null;

  return (
    <div id="toast-region" aria-live="polite">
      <div className="toast" role="status">
        {toastMessage}
      </div>
    </div>
  );
}
