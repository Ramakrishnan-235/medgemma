"use client";

import { useEffect } from "react";
import { isPageId } from "@/types/workspace";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

export function useWorkspaceNavigation() {
  useEffect(() => {
    const syncPage = () => {
      const hash = window.location.hash.slice(1);
      useWorkspaceStore.setState({ page: isPageId(hash) ? hash : "overview" });
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") useWorkspaceStore.getState().closeModal();
    };

    syncPage();
    window.addEventListener("hashchange", syncPage);
    window.addEventListener("popstate", syncPage);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("hashchange", syncPage);
      window.removeEventListener("popstate", syncPage);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);
}
