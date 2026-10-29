"use client";

import { useShallow } from "zustand/react/shallow";
import React, { useEffect, useState } from "react";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { INITIAL_LIBRARY_FILES, type LibraryItem } from "@/types/workspace";
import { Heading, Badge } from "../CommonUI";
import { Icon } from "../Icons";
import { api, type ApiSourceFile } from "@/lib/api";

export function LibraryScreen() {
  const {
    libraryType,
    setLibraryType,
    librarySearch,
    setLibrarySearch,
    setPage,
    openModal,
    activeCaseId,
    activeCase,
    setActiveSourceId,
  } = useWorkspaceStore(
    useShallow((state) => ({
      libraryType: state.libraryType,
      setLibraryType: state.setLibraryType,
      librarySearch: state.librarySearch,
      setLibrarySearch: state.setLibrarySearch,
      setPage: state.setPage,
      openModal: state.openModal,
      activeCaseId: state.activeCaseId,
      activeCase: state.activeCase,
      setActiveSourceId: state.setActiveSourceId,
    }))
  );

  const [liveItems, setLiveItems] = useState<LibraryItem[]>([]);

  useEffect(() => {
    async function loadSources() {
      if (!activeCaseId) return;
      try {
        const sources = await api.listCaseSources(activeCaseId);
        if (sources && sources.length > 0) {
          const mapped: LibraryItem[] = sources.map((s: ApiSourceFile) => {
            const isImg = s.file_kind.includes("image") || s.file_kind === "dicom";
            return {
              icon: isImg ? "scan" : "file",
              name: s.filename,
              category: isImg ? "Imaging" : "Documents",
              caseContext: activeCase || "Current case",
              date: new Date(s.created_at).toLocaleDateString(),
              status: s.parse_status === "parsed" ? "Verified" : s.parse_status,
              page: isImg ? "imaging" : "ehr",
            };
          });
          setLiveItems(mapped);
        }
      } catch {
        // Backend offline fallback
      }
    }
    loadSources();
  }, [activeCaseId, activeCase]);

  const tabs = [
    "All files",
    "Imaging",
    "Documents",
    "Reports",
    "Conversations",
  ];

  const allItems = [...liveItems, ...INITIAL_LIBRARY_FILES];

  const filtered = allItems.filter((f) => {
    const matchesCategory =
      libraryType === "All files" || f.category === libraryType;
    const matchesSearch =
      f.name.toLowerCase().includes(librarySearch.toLowerCase()) ||
      f.caseContext.toLowerCase().includes(librarySearch.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <>
      <Heading
        eyebrow="WORKSPACE / LIBRARY"
        title="A home for the evidence."
        desc="Your files, studies, conversations and reports."
        actions={
          <button
            type="button"
            className="btn black"
            onClick={() => openModal("upload")}
          >
            <Icon name="upload" /> Add files
          </button>
        }
      />

      {/* Tabs and Search Toolbar */}
      <div className="toolbar">
        <div className="tabs" aria-label="Library filter tabs">
          {tabs.map((t) => (
            <button
              key={t}
              type="button"
              className={libraryType === t ? "selected" : ""}
              onClick={() => setLibraryType(t)}
            >
              {t}
            </button>
          ))}
        </div>

        <label className="search">
          <Icon name="search" />
          <input
            id="library-search"
            placeholder="Search library..."
            aria-label="Search library"
            value={librarySearch}
            onChange={(e) => setLibrarySearch(e.target.value)}
          />
        </label>
      </div>

      {/* Library Table Panel */}
      <section className="panel">
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>FILE / RESOURCE</th>
                <th>TYPE</th>
                <th>CASE CONTEXT</th>
                <th>DATE</th>
                <th>STATUS</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="library-rows">
              {filtered.length > 0 ? (
                filtered.map((item, idx) => (
                  <tr
                    key={`${item.name}-${idx}`}
                    onClick={() => {
                      if (item.category === "Imaging") {
                        setActiveSourceId(null);
                      }
                      setPage(item.page);
                    }}
                    style={{ cursor: "pointer" }}
                  >
                    <td>
                      <span className="fileicon">
                        <Icon name={item.icon} />
                      </span>
                      {item.name}
                    </td>
                    <td className="muted">{item.category}</td>
                    <td>{item.caseContext}</td>
                    <td className="muted">{item.date}</td>
                    <td>
                      <Badge text={item.status} />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn tiny ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPage(item.page);
                        }}
                        aria-label={`Open ${item.name}`}
                      >
                        <Icon name="chevron" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-6 text-neutral-500">
                    No matching files found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
