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
        <div className="tabs" aria-label="Filter cases">
          {filterTabs.map((tab) => (
            <button
              key={tab}
              type="button"
              className={caseFilter === tab ? "selected" : ""}
              onClick={() => setCaseFilter(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        <label className="search">
          <Icon name="search" />
          <input
            id="case-search"
            aria-label="Search cases"
            placeholder="Search cases..."
            value={caseSearch}
            onChange={(e) => setCaseSearch(e.target.value)}
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
              {filteredCases.length > 0 ? (
                filteredCases.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => handleSelectCase(c)}
                    style={{ cursor: "pointer" }}
                  >
                    <td>
                      <span className="case-name">
                        {c.name}
                        <small>ID: {c.id.slice(0, 8)}</small>
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
                            : ""
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
                  <td colSpan={5} className="text-center py-6 text-neutral-500">
                    No matching cases found. Click &quot;New case&quot; to create one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="note" style={{ marginTop: "20px" }}>
        Connected to FastAPI & pgvector multi-tenant cases API. Selecting any case sets workspace context for imaging, reports, and Q&amp;A.
      </div>
    </>
  );
}
