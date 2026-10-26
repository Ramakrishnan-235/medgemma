"use client";

import React from "react";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { Heading, Badge } from "../CommonUI";
import { Icon } from "../Icons";

export function CasesScreen() {
  const {
    cases,
    caseFilter,
    setCaseFilter,
    caseSearch,
    setCaseSearch,
    setPage,
    openModal,
  } = useWorkspaceStore();

  const filterTabs = ["All cases", "Needs review", "Draft ready", "Reviewed"];

  const filteredCases = cases.filter((c) => {
    const matchesFilter =
      caseFilter === "All cases" || c.status === caseFilter;
    const matchesSearch =
      c.name.toLowerCase().includes(caseSearch.toLowerCase()) ||
      c.id.includes(caseSearch) ||
      c.meta.toLowerCase().includes(caseSearch.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <>
      <Heading
        eyebrow="CASE MANAGEMENT"
        title="Every case. One place."
        desc="Keep your files, conversations and findings connected."
        actions={
          <button
            type="button"
            className="btn black"
            onClick={() => openModal("newcase")}
          >
            <Icon name="plus" /> New case
          </button>
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
                    onClick={() => setPage("case")}
                    style={{ cursor: "pointer" }}
                  >
                    <td>
                      <span className="case-name">
                        {c.name}
                        <small>CASE {c.id} · Demo</small>
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
                          setPage("case");
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
                    No matching demo cases.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="note" style={{ marginTop: "20px" }}>
        Demo cases illustrate the layout. Creating a case here changes only this preview session.
      </div>
    </>
  );
}
