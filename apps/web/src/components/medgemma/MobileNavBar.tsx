"use client";

import React, { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { Icon } from "./Icons";
import { type PageId } from "@/types/workspace";

export function MobileNavBar() {
  const { page, setPage, cases, openModal } = useWorkspaceStore(
    useShallow((state) => ({
      page: state.page,
      setPage: state.setPage,
      cases: state.cases,
      openModal: state.openModal,
    }))
  );

  const [menuOpen, setMenuOpen] = useState(false);

  const isAssistant = ["chat", "qa"].includes(page);
  const isImaging = ["imaging", "compare"].includes(page);
  const isCases = ["cases", "case"].includes(page);

  const handleNav = (target: PageId) => {
    setPage(target);
    setMenuOpen(false);
  };

  return (
    <>
      {/* Mobile Secondary Menu Drawer */}
      {menuOpen && (
        <div
          className="fixed inset-0 bg-black/70 z-40 min-[851px]:hidden flex flex-col justify-end"
          onClick={() => setMenuOpen(false)}
        >
          <div
            className="bg-[#18181b] border-t border-[#27272a] rounded-t-2xl p-5 pb-8 max-h-[75vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#27272a]">
              <span className="text-[12px] font-semibold text-[#f4f4f5] tracking-wide uppercase">
                Workspace Navigation
              </span>
              <button
                type="button"
                className="text-[#a1a1aa] hover:text-[#f4f4f5] text-[16px] px-2 py-1"
                onClick={() => setMenuOpen(false)}
                aria-label="Close menu"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-4">
              <button
                type="button"
                className="flex items-center gap-2 p-2.5 rounded-lg bg-[#27272a]/60 text-left text-[12px] text-[#f4f4f5] hover:bg-[#27272a]"
                onClick={() => {
                  setMenuOpen(false);
                  openModal("newcase");
                }}
              >
                <Icon name="plus" className="text-white" />
                <span>+ New Case</span>
              </button>
              <button
                type="button"
                className="flex items-center gap-2 p-2.5 rounded-lg bg-[#27272a]/60 text-left text-[12px] text-[#f4f4f5] hover:bg-[#27272a]"
                onClick={() => {
                  setMenuOpen(false);
                  openModal("upload");
                }}
              >
                <Icon name="upload" className="text-white" />
                <span>Add Source</span>
              </button>
            </div>

            <div className="space-y-1">
              {[
                { id: "reasoning", label: "Clinical reasoning", icon: "text" },
                { id: "ehr", label: "EHR summary", icon: "text" },
                { id: "extraction", label: "Document extraction", icon: "file" },
                { id: "report", label: "Report studio", icon: "report" },
                { id: "compare", label: "Longitudinal tracking", icon: "compare" },
                { id: "qa", label: "Medical Q&A", icon: "chat" },
                { id: "library", label: "Library", icon: "library" },
                { id: "settings", label: "Settings", icon: "settings" },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left text-[12px] ${
                    page === item.id
                      ? "bg-[#27272a] text-[#f4f4f5] font-semibold"
                      : "text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#27272a]/40"
                  }`}
                  onClick={() => handleNav(item.id as PageId)}
                >
                  <Icon name={item.icon} />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Persistent Bottom Mobile Nav Bar (<850px) */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 bg-[#18181b] border-t border-[#27272a] h-14 flex items-center justify-around px-2 text-[#a1a1aa] min-[851px]:hidden pb-[env(safe-area-inset-bottom)]"
        aria-label="Mobile navigation"
      >
        <button
          type="button"
          className={`flex flex-col items-center justify-center flex-1 py-1 text-[10px] ${
            page === "overview" ? "text-white font-semibold" : "text-[#a1a1aa] hover:text-[#f4f4f5]"
          }`}
          onClick={() => handleNav("overview")}
        >
          <Icon name="home" />
          <span className="mt-0.5">Overview</span>
        </button>

        <button
          type="button"
          className={`flex flex-col items-center justify-center flex-1 py-1 text-[10px] relative ${
            isCases ? "text-white font-semibold" : "text-[#a1a1aa] hover:text-[#f4f4f5]"
          }`}
          onClick={() => handleNav("cases")}
        >
          <Icon name="folder" />
          <span className="mt-0.5">Cases</span>
          {cases.length > 0 && (
            <span className="absolute top-1 right-5 text-[8px] px-1 bg-[#27272a] border border-[#3f3f46] rounded-full text-zinc-300">
              {cases.length}
            </span>
          )}
        </button>

        <button
          type="button"
          className={`flex flex-col items-center justify-center flex-1 py-1 text-[10px] ${
            isImaging ? "text-white font-semibold" : "text-[#a1a1aa] hover:text-[#f4f4f5]"
          }`}
          onClick={() => handleNav("imaging")}
        >
          <Icon name="scan" />
          <span className="mt-0.5">Imaging</span>
        </button>

        <button
          type="button"
          className={`flex flex-col items-center justify-center flex-1 py-1 text-[10px] ${
            isAssistant ? "text-white font-semibold" : "text-[#a1a1aa] hover:text-[#f4f4f5]"
          }`}
          onClick={() => handleNav("chat")}
        >
          <Icon name="chat" />
          <span className="mt-0.5">Assistant</span>
        </button>

        <button
          type="button"
          className={`flex flex-col items-center justify-center flex-1 py-1 text-[10px] ${
            menuOpen ? "text-white font-semibold" : "text-[#a1a1aa] hover:text-[#f4f4f5]"
          }`}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-expanded={menuOpen}
        >
          <Icon name="more" />
          <span className="mt-0.5">More</span>
        </button>
      </nav>
    </>
  );
}

