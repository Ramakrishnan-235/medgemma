"use client";

import { useShallow } from "zustand/react/shallow";
import React from "react";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { PAGES } from "@/types/workspace";
import { Icon } from "./Icons";

export function Topbar() {
  const { page, setPage, activeCase, activeCaseId, setActiveCase, cases } =
    useWorkspaceStore(
      useShallow((state) => ({
        page: state.page,
        setPage: state.setPage,
        activeCase: state.activeCase,
        activeCaseId: state.activeCaseId,
        setActiveCase: state.setActiveCase,
        cases: state.cases,
      })),
    );

  const currentPageLabel =
    PAGES.find(([id]) => id === page)?.[1] || "Workspace";

  // Derive active select value based on activeCaseId or case name match
  const matchedCase = cases.find(
    (c) =>
      c.id === activeCaseId ||
      c.name === activeCase ||
      activeCase?.includes(c.id) ||
      (c.id === "024" && activeCase?.includes("024")),
  );
  const selectValue =
    activeCase === "No case context" ? "none" : matchedCase ? matchedCase.id : "none";

  const handleCaseChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === "none") {
      setActiveCase("No case context", "");
    } else {
      const selectedCase = cases.find((c) => c.id === val);
      if (selectedCase) {
        const caseLabel =
          selectedCase.id === "024"
            ? "Case 024 · Chest review"
            : `Case ${selectedCase.id} · ${selectedCase.name}`;
        setActiveCase(caseLabel, selectedCase.id);
      }
    }
  };

  return (
    <header className="topbar flex items-center justify-between h-[72px] bg-[#18181b] border-b border-[#27272a] px-[34px] gap-4 shrink-0">
      {/* Left: Breadcrumbs Trail */}
      <div className="crumb flex items-center gap-3.5 text-[11px] text-zinc-400">
        <span
          className="mobile-brand cursor-pointer flex items-center gap-2 text-xs font-semibold"
          onClick={() => setPage("overview")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") setPage("overview");
          }}
        >
          <span className="brandmark">+</span>MedGemma
        </span>
        <button
          type="button"
          onClick={() => setPage("overview")}
          className="desktop text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer bg-transparent border-0 p-0 text-[11px] font-normal"
        >
          Workspace
        </button>
        <span className="desktop text-zinc-600">/</span>
        <b className="font-medium text-zinc-100">{currentPageLabel}</b>
      </div>

      {/* Right: Actions Cluster */}
      <div className="top-actions flex items-center gap-4.5">
        {/* Active Case Selector */}
        <select
          className="case-picker border border-[#27272a] bg-[#09090b] text-zinc-100 rounded-md px-2.5 py-1.5 text-[10px] font-medium hover:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-400 max-w-[210px] truncate cursor-pointer transition-colors"
          aria-label="Active case"
          value={selectValue}
          onChange={handleCaseChange}
        >
          {cases.map((c) => {
            const label =
              c.id === "024" ? "Case 024 · Chest review" : `Case ${c.id} · ${c.name}`;
            return (
              <option key={c.id} value={c.id} className="bg-[#18181b] text-zinc-100">
                {label}
              </option>
            );
          })}
          <option value="none" className="bg-[#18181b] text-zinc-400">
            No case context
          </option>
        </select>

        {/* Search Library Button (34x34px) */}
        <button
          type="button"
          className="btn iconbtn ghost desktop w-[34px] h-[34px] min-h-[34px] p-0 flex items-center justify-center rounded-md border border-transparent hover:border-[#27272a] hover:bg-[#27272a] text-zinc-400 hover:text-zinc-100 transition-colors"
          onClick={() => setPage("library")}
          aria-label="Search library"
          title="Search library"
        >
          <Icon name="search" />
        </button>

        {/* User Avatar (29x29px) */}
        <span
          className="avatar w-[29px] h-[29px] rounded-full bg-[#27272a] border border-[#3f3f46] text-zinc-100 flex items-center justify-center text-[10px] font-semibold select-none shrink-0"
          title="Dr. Morgan (Demo account)"
          aria-label="User profile: Dr. Morgan"
        >
          DM
        </span>
      </div>
    </header>
  );
}
