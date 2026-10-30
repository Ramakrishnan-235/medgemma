"use client";

import { useShallow } from "zustand/react/shallow";
import React, { useState } from "react";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { Icon } from "./Icons";
import { type PageId } from "@/types/workspace";

export function Sidebar() {
  const { page, setPage, setSettingTab, showToast, cases } = useWorkspaceStore(
    useShallow((state) => ({
      page: state.page,
      setPage: state.setPage,
      setSettingTab: state.setSettingTab,
      showToast: state.showToast,
      cases: state.cases,
    }))
  );

  // Group expansion state: auto-expands active group, supports manual accordion toggle
  const isAssistantActive = ["chat", "qa"].includes(page);
  const isImagingActive = ["imaging", "compare"].includes(page);
  const isClinicalActive = ["reasoning", "ehr"].includes(page);

  const [expandedGroups, setExpandedGroups] = useState<{
    assistant?: boolean;
    imaging?: boolean;
    clinical?: boolean;
  }>({});

  const isAssistantOpen = expandedGroups.assistant ?? isAssistantActive;
  const isImagingOpen = expandedGroups.imaging ?? isImagingActive;
  const isClinicalOpen = expandedGroups.clinical ?? isClinicalActive;

  const toggleGroup = (group: "assistant" | "imaging" | "clinical") => {
    setExpandedGroups((prev) => {
      const current =
        group === "assistant"
          ? isAssistantOpen
          : group === "imaging"
          ? isImagingOpen
          : isClinicalOpen;
      return { ...prev, [group]: !current };
    });
  };

  // Nav button builder with Linear/Vercel monochrome dark tokens
  const navButton = (
    label: string,
    targetPage: PageId,
    iconName: string,
    isActive: boolean,
    count?: string,
    hasSubnav?: boolean,
    isOpen?: boolean,
    onToggle?: () => void
  ) => (
    <div className="relative flex items-center w-full">
      <button
        type="button"
        aria-current={isActive ? "page" : undefined}
        className={`flex items-center gap-2.5 w-full text-left py-2 px-3 rounded-[7px] text-xs transition-colors duration-150 outline-none focus-visible:ring-1 focus-visible:ring-zinc-400 select-none ${
          isActive
            ? "bg-[#27272a] text-[#f4f4f5] font-semibold active"
            : "text-zinc-400 hover:text-zinc-100 hover:bg-[#27272a]/60 font-medium"
        }`}
        onClick={() => {
          setPage(targetPage);
          if (hasSubnav && onToggle && !isOpen) {
            onToggle();
          }
        }}
      >
        <Icon name={iconName} className="w-[18px] h-[18px] flex-none" />
        <span className="truncate">{label}</span>
        {count && (
          <span className="count ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded border border-[#3f3f46] bg-[#27272a] text-zinc-300 leading-none">
            {count}
          </span>
        )}
      </button>
      {hasSubnav && onToggle && (
        <button
          type="button"
          aria-label={`Toggle ${label} subnavigation`}
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className="absolute right-1 p-1 text-zinc-500 hover:text-zinc-200 rounded transition-colors"
        >
          <svg
            className={`w-3.5 h-3.5 transition-transform duration-200 ${
              isOpen ? "rotate-90 text-zinc-300" : "text-zinc-500"
            }`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m9 5 7 7-7 7" />
          </svg>
        </button>
      )}
    </div>
  );

  // Subnav item builder
  const subnavButton = (
    label: string,
    targetPage: PageId,
    isActive: boolean
  ) => (
    <button
      type="button"
      aria-current={isActive ? "page" : undefined}
      className={`subnav pl-10 pr-3 py-1.5 text-[11px] rounded-[6px] w-full text-left block transition-colors duration-150 outline-none focus-visible:ring-1 focus-visible:ring-zinc-400 select-none ${
        isActive
          ? "bg-[#27272a] text-[#f4f4f5] font-medium active"
          : "text-zinc-400 hover:text-zinc-200 hover:bg-[#27272a]/40"
      }`}
      onClick={() => setPage(targetPage)}
    >
      {label}
    </button>
  );

  // Cases count: default to "12" matching prototype & Overview metric card
  const casesCount = cases.length > 12 ? String(cases.length) : "12";

  return (
    <aside className="sidebar bg-[#18181b] border-r border-[#27272a] p-[26px_16px_18px] flex flex-col gap-6 w-[224px] select-none">
      {/* 1. Brand Header */}
      <button
        type="button"
        aria-label="MedGemma clinical workspace home"
        className="brand group flex items-center gap-2.5 text-left outline-none focus-visible:ring-1 focus-visible:ring-zinc-400 rounded-lg transition-opacity hover:opacity-95 cursor-pointer bg-transparent border-0 p-0"
        onClick={() => setPage("overview")}
      >
        <span className="brandmark w-8 h-8 rounded-[9px] bg-white text-[#09090b] text-[23px] font-normal leading-none grid place-items-center flex-none shadow-sm transition-transform duration-150 group-hover:scale-105 select-none">
          +
        </span>
        <span className="flex flex-col text-left">
          <span className="text-[18px] font-semibold tracking-[-0.6px] text-[#f4f4f5] leading-tight">
            MedGemma
          </span>
          <small className="block text-[10px] font-normal uppercase tracking-[0.2px] text-zinc-400 -mt-0.5">
            CLINICAL WORKSPACE
          </small>
        </span>
      </button>

      {/* 2. Workspace Selector */}
      <button
        type="button"
        aria-label="Workspace switcher: My workspace (Personal · Demo)"
        onClick={() => {
          showToast("Workspace switcher: Personal · Demo workspace active");
        }}
        className="workspace group flex items-center gap-[9px] text-xs text-zinc-200 w-full text-left p-2.5 rounded-lg border border-[#27272a] bg-[#18181b] hover:bg-zinc-800/60 hover:border-zinc-700 transition-all duration-150 outline-none focus-visible:ring-1 focus-visible:ring-zinc-400 cursor-pointer"
      >
        <span className="square w-[26px] h-[26px] rounded-[6px] bg-[#27272a] border border-[#3f3f46] text-zinc-200 font-semibold text-xs grid place-items-center flex-none select-none">
          M
        </span>
        <span className="flex flex-col text-left leading-tight truncate">
          <span className="text-xs font-medium text-zinc-200">My workspace</span>
          <small className="text-[10px] text-zinc-400 mt-0.5">Personal · Demo</small>
        </span>
        <svg
          className="w-3.5 h-3.5 ml-auto text-zinc-500 group-hover:text-zinc-300 transition-colors flex-none"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {/* 3. Primary Navigation */}
      <div className="flex flex-col">
        <p className="navlabel px-2.5 mb-2 text-[10px] font-semibold uppercase tracking-[1.25px] text-zinc-400">
          WORKSPACE
        </p>
        <nav className="nav flex flex-col gap-[3px]" aria-label="Primary navigation">
          {navButton("Overview", "overview", "home", page === "overview")}
          {navButton(
            "Cases",
            "cases",
            "folder",
            ["cases", "case"].includes(page),
            casesCount
          )}

          {/* Assistant + Subnavigation */}
          {navButton(
            "Assistant",
            "chat",
            "chat",
            isAssistantActive,
            undefined,
            true,
            isAssistantOpen,
            () => toggleGroup("assistant")
          )}
          {isAssistantOpen && (
            <div className="flex flex-col gap-[2px] mt-[1px] mb-[2px] relative before:absolute before:left-[22px] before:top-1 before:bottom-1 before:w-[1px] before:bg-zinc-800/60">
              {subnavButton("General chat", "chat", page === "chat")}
              {subnavButton("Medical Q&A", "qa", page === "qa")}
            </div>
          )}

          {/* Medical imaging + Subnavigation */}
          {navButton(
            "Medical imaging",
            "imaging",
            "scan",
            isImagingActive,
            undefined,
            true,
            isImagingOpen,
            () => toggleGroup("imaging")
          )}
          {isImagingOpen && (
            <div className="flex flex-col gap-[2px] mt-[1px] mb-[2px] relative before:absolute before:left-[22px] before:top-1 before:bottom-1 before:w-[1px] before:bg-zinc-800/60">
              {subnavButton("Image workspace", "imaging", page === "imaging")}
              {subnavButton("Longitudinal tracking", "compare", page === "compare")}
            </div>
          )}

          {/* Clinical text + Subnavigation */}
          {navButton(
            "Clinical text",
            "reasoning",
            "text",
            isClinicalActive,
            undefined,
            true,
            isClinicalOpen,
            () => toggleGroup("clinical")
          )}
          {isClinicalOpen && (
            <div className="flex flex-col gap-[2px] mt-[1px] mb-[2px] relative before:absolute before:left-[22px] before:top-1 before:bottom-1 before:w-[1px] before:bg-zinc-800/60">
              {subnavButton("Clinical reasoning", "reasoning", page === "reasoning")}
              {subnavButton("EHR summary", "ehr", page === "ehr")}
            </div>
          )}

          {navButton("Documents", "extraction", "file", page === "extraction")}
          {navButton("Reports", "report", "report", page === "report")}
          {navButton("Library", "library", "library", page === "library")}
        </nav>
      </div>

      {/* 4. Sidebar Footer */}
      <div className="sidebar-bottom mt-auto pt-14 flex flex-col gap-3">
        {/* Model connection card */}
        <button
          type="button"
          aria-label="Model connection configuration"
          className="model group flex flex-col w-full text-left p-3 rounded-lg border border-[#27272a] bg-[#18181b] hover:bg-zinc-800/50 hover:border-zinc-700 transition-all duration-150 outline-none focus-visible:ring-1 focus-visible:ring-zinc-400 cursor-pointer"
          onClick={() => {
            setSettingTab("Model connection");
            setPage("settings");
          }}
        >
          <div className="flex items-center gap-2 font-medium text-zinc-200 text-[11px]">
            <Icon
              name="volume"
              className="w-4 h-4 text-zinc-400 group-hover:text-zinc-200 transition-colors"
            />
            <span>Model connection</span>
          </div>
          <p className="mt-1 text-[10px] text-zinc-400 leading-tight">
            Configure in workspace settings
          </p>
        </button>

        {/* Settings button */}
        <nav className="nav flex flex-col" aria-label="Settings navigation">
          {navButton("Settings", "settings", "settings", page === "settings")}
        </nav>

        {/* Dr. Morgan profile chip */}
        <button
          type="button"
          aria-label="Clinician profile: Dr. Morgan (Demo account)"
          className="profile group flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-zinc-800/50 transition-colors text-left w-full outline-none focus-visible:ring-1 focus-visible:ring-zinc-400 cursor-pointer border-0 bg-transparent"
          onClick={() => {
            setSettingTab("Profile");
            setPage("settings");
          }}
        >
          <span className="avatar w-[29px] h-[29px] rounded-full bg-[#27272a] border border-[#3f3f46] text-zinc-200 text-[10px] font-semibold grid place-items-center flex-none select-none">
            DM
          </span>
          <span className="flex flex-col text-left leading-tight truncate">
            <span className="text-[11px] font-medium text-zinc-200 group-hover:text-zinc-100 transition-colors">
              Dr. Morgan
            </span>
            <small className="muted text-[9px] text-zinc-400 block mt-0.5">
              Demo account
            </small>
          </span>
        </button>
      </div>
    </aside>
  );
}
