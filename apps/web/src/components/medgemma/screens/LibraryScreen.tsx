"use client";

import React from "react";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { INITIAL_LIBRARY_FILES } from "@/types/workspace";
import { Heading, Badge } from "../CommonUI";
import { Icon } from "../Icons";

export function LibraryScreen() {
  const {
    libraryType,
    setLibraryType,
    librarySearch,
    setLibrarySearch,
    setPage,
    openModal,
  } = useWorkspaceStore();

  const tabs = [
    "All files",
    "Imaging",
    "Documents",
    "Reports",
    "Conversations",
  ];

  const filtered = INITIAL_LIBRARY_FILES.filter((f) => {
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
                filtered.map((item) => (
                  <tr
                    key={item.name}
                    onClick={() => setPage(item.page)}
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
