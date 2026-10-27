"use client";

import { useShallow } from "zustand/react/shallow";

import React from "react";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { PAGES } from "@/types/workspace";
import { Icon } from "./Icons";

export function Topbar() {
  const { page, setPage, activeCase, setActiveCase } = useWorkspaceStore(
    useShallow((state) => ({
      page: state.page,
      setPage: state.setPage,
      activeCase: state.activeCase,
      setActiveCase: state.setActiveCase,
    })),
  );

  const currentPageLabel =
    PAGES.find(([id]) => id === page)?.[1] || "Workspace";

  return (
    <header className="topbar">
      <div className="crumb">
        <span
          className="mobile-brand cursor-pointer"
          onClick={() => setPage("overview")}
        >
          <span className="brandmark">+</span>MedGemma
        </span>
        <span className="desktop">Workspace</span>
        <span className="desktop">/</span>
        <b>{currentPageLabel}</b>
      </div>

      <div className="top-actions">
        <select
          className="case-picker"
          aria-label="Active case"
          value={activeCase}
          onChange={(e) => setActiveCase(e.target.value)}
        >
          <option value="Case 024 · Chest review">Case 024 · Chest review</option>
          <option value="No case context">No case context</option>
        </select>

        <button
          type="button"
          className="btn iconbtn ghost desktop"
          onClick={() => setPage("library")}
          aria-label="Search library"
        >
          <Icon name="search" />
        </button>

        <span className="avatar">DM</span>
      </div>
    </header>
  );
}
