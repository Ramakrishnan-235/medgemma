"use client";

import { useShallow } from "zustand/react/shallow";
import React, { useEffect, useState } from "react";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { Heading, Badge } from "../CommonUI";
import { Icon } from "../Icons";
import { api, type ApiCase } from "@/lib/api";
import { type CaseItem } from "@/types/workspace";

export function CasesScreen() {
  const {
    cases,
    setCases,
    caseFilter,
    setCaseFilter,
    caseSearch,
    setCaseSearch,
    setPage,
    openModal,
    setActiveCase,
    showToast,
  } = useWorkspaceStore(
    useShallow((state) => ({
      cases: state.cases,
      setCases: state.setCases,
      caseFilter: state.caseFilter,
      setCaseFilter: state.setCaseFilter,
      caseSearch: state.caseSearch,
      setCaseSearch: state.setCaseSearch,
      setPage: state.setPage,
      openModal: state.openModal,
      setActiveCase: state.setActiveCase,
      showToast: state.showToast,
    }))
  );

  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const filterTabs = ["All cases", "Needs review", "Draft ready", "In progress", "Reviewed"];

  const loadBackendCases = async () => {
    setIsLoading(true);
    try {
      const serverCases = await api.listCases();
      if (serverCases && serverCases.length > 0) {
        const mappedCases: CaseItem[] = serverCases.map((sc: ApiCase) => ({
          id: sc.id,
          name: sc.title || `Patient ${sc.patient_code}`,
          meta: `${sc.patient_code} · ${sc.sources_count} sources`,
          status: sc.status || "In progress",
          date: new Date(sc.created_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }),
        }));
        setCases(mappedCases);
      }
    } catch {
      // Backend not running or offline; keep existing cases
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBackendCases();
  }, []);

  const filteredCases = cases.filter((c) => {
    const matchesFilter =
      caseFilter === "All cases" || c.status === caseFilter;
    const matchesSearch =
      c.name.toLowerCase().includes(caseSearch.toLowerCase()) ||
      c.id.includes(caseSearch) ||
      c.meta.toLowerCase().includes(caseSearch.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const totalPages = Math.max(1, Math.ceil(filteredCases.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedCases = filteredCases.slice(
    (safeCurrentPage - 1) * pageSize,
    safeCurrentPage * pageSize
  );

  const handleSelectCase = (c: CaseItem) => {
    setActiveCase(c.name, c.id);
    showToast(`Switched active context to ${c.name}`);
    setPage("case");
  };

  return (
    <>
      <Heading
        eyebrow="CASE MANAGEMENT"
        title="Every case. One place."
        desc="Keep your files, conversations and findings connected."
        actions={
          <div className="row gap-2">
            <button
              type="button"
              className="btn"
              onClick={loadBackendCases}
              disabled={isLoading}
              title="Refresh from PostgreSQL backend"
            >
              <Icon name="clock" /> {isLoading ? "Syncing..." : "Sync Cases"}
            </button>
            <button
              type="button"
              className="btn black"
              onClick={() => openModal("newcase")}
            >
              <Icon name="plus" /> New case
            </button>
          </div>
        }
      />

      {/* Filter and Search Toolbar */}
      <div className="toolbar">
        <div className="tabs" aria-label="Filter cases" role="tablist">
          {filterTabs.map((tab) => {
            const count =
              tab === "All cases"
                ? cases.length
                : cases.filter((c) => c.status === tab).length;
            const isSelected = caseFilter === tab;
            return (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={isSelected}
                className={isSelected ? "selected" : ""}
                onClick={() => {
                  setCaseFilter(tab);
                  setCurrentPage(1);
                }}
              >
                {tab}
                <span className="opacity-60 text-[9px] ml-1">({count})</span>
              </button>
            );
          })}
        </div>

        <label className="search">
          <Icon name="search" />
          <input
            id="case-search"
            aria-label="Search cases"
            placeholder="Search cases..."
            value={caseSearch}
            onChange={(e) => {
              setCaseSearch(e.target.value);
              setCurrentPage(1);
            }}
          />
        </label>
      </div>

      {/* Case Table Panel */}
      <section className="panel">
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>CASE</th>
                <th>CONTEXT</th>
                <th>STATUS</th>
                <th>LAST ACTIVITY</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {paginatedCases.length > 0 ? (
                paginatedCases.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => handleSelectCase(c)}
                    className="cursor-pointer hover:bg-zinc-800/40 transition-colors"
                  >
                    <td>
                      <span className="case-name">
                        {c.name}
                        <small>ID: {c.id.length > 8 ? c.id.slice(0, 8) : c.id}</small>
                      </span>
                    </td>
                    <td className="muted">{c.meta}</td>
                    <td>
                      <Badge
                        text={c.status}
                        variant={
                          c.status === "Needs review"
                            ? "dark"
                            : c.status === "Reviewed"
                            ? "soft"
                            : "dash"
                        }
                      />
                    </td>
                    <td className="muted">{c.date}</td>
                    <td>
                      <button
                        type="button"
                        className="btn tiny ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectCase(c);
                        }}
                        aria-label={`Open ${c.name}`}
                      >
                        <Icon name="chevron" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="text-center py-6 text-zinc-400">
                    No matching cases found. Click &quot;New case&quot; to create one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Minimalist Monochrome Pagination Controls */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-zinc-800 text-xs text-zinc-400">
          <span>
            Showing {filteredCases.length > 0 ? (safeCurrentPage - 1) * pageSize + 1 : 0}–
            {Math.min(safeCurrentPage * pageSize, filteredCases.length)} of {filteredCases.length} cases
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="btn tiny ghost"
              disabled={safeCurrentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              aria-label="Previous page"
            >
              <Icon name="chevron" /> Prev
            </button>
            <span className="px-2 py-1 text-[11px] font-mono text-zinc-300">
              {safeCurrentPage} / {totalPages}
            </span>
            <button
              type="button"
              className="btn tiny ghost"
              disabled={safeCurrentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              aria-label="Next page"
            >
              Next <Icon name="chevron" />
            </button>
          </div>
        </div>
      </section>

      <div className="note mt-5">
        Connected to FastAPI & pgvector multi-tenant cases API. Selecting any case sets workspace context for imaging, reports, and Q&amp;A.
      </div>
    </>
  );
}
