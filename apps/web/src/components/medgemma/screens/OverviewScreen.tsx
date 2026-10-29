"use client";

import { useShallow } from "zustand/react/shallow";
import React, { useEffect } from "react";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { Heading, Badge } from "../CommonUI";
import { Icon } from "../Icons";
import { api, type ApiCase } from "@/lib/api";
import { type CaseItem } from "@/types/workspace";

export function OverviewScreen() {
  const { setPage, cases, setCases, setActiveCase, openModal } = useWorkspaceStore(
    useShallow((state) => ({
      setPage: state.setPage,
      cases: state.cases,
      setCases: state.setCases,
      setActiveCase: state.setActiveCase,
      openModal: state.openModal,
    }))
  );

  useEffect(() => {
    async function syncCases() {
      try {
        const serverCases = await api.listCases();
        if (serverCases && serverCases.length > 0) {
          const mapped: CaseItem[] = serverCases.map((sc: ApiCase) => ({
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
          setCases(mapped);
        }
      } catch {
        // Local preview fallback
      }
    }
    syncCases();
  }, [setCases]);

  const recentCases = cases.slice(0, 4);

  const handleSelectCase = (c: CaseItem) => {
    setActiveCase(c.name, c.id);
    setPage("case");
  };

  return (
    <>
      <Heading
        eyebrow="WORKSPACE OVERVIEW"
        title="Good morning, Clinician."
        desc="A unified clinical intelligence workspace powered by MedGemma 1.5."
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

      {/* 3 Overview Stat Panels */}
      <div className="stats">
        <div className="stat">
          <label>
            Active cases <Icon name="folder" />
          </label>
          <strong>{String(cases.length).padStart(2, "0")}</strong>
          <small>PostgreSQL multi-tenant cases</small>
        </div>
        <div className="stat">
          <label>
            Awaiting review <Icon name="eye" />
          </label>
          <strong>04</strong>
          <small>Imaging &amp; EHR extractions</small>
        </div>
        <div className="stat">
          <label>
            Report drafts <Icon name="report" />
          </label>
          <strong>08</strong>
          <small>Versioned TipTap drafts</small>
        </div>
      </div>

      {/* Quick Launch Cards */}
      <div className="row between">
        <h2>What would you like to work on?</h2>
        <span className="design-label">CLINICAL SUITE</span>
      </div>

      <div className="quickgrid">
        {[
          {
            icon: "scan",
            title: "Review an image",
            desc: "Cornerstone3D DICOM & CXR workspace with SigLIP 896px grounding.",
            target: "imaging" as const,
          },
          {
            icon: "text",
            title: "Understand a record",
            desc: "Synthesize EHR timeline with verifiable evidence chunks.",
            target: "ehr" as const,
          },
          {
            icon: "chat",
            title: "Start a conversation",
            desc: "Streaming multimodal clinical Q&A with E5-small-v2 hybrid RRF.",
            target: "chat" as const,
          },
        ].map((item) => (
          <button
            key={item.title}
            type="button"
            className="quick"
            onClick={() => setPage(item.target)}
          >
            <span className="tileicon">
              <Icon name={item.icon} />
            </span>
            <div>
              <h3>{item.title}</h3>
              <p>{item.desc}</p>
            </div>
            <span className="arrow">
              <Icon name="arrow" />
            </span>
          </button>
        ))}
      </div>

      {/* Two Column Section */}
      <div className="cols">
        <section className="panel">
          <div className="panel-head">
            <h2>Recent cases</h2>
            <button
              type="button"
              className="linkbutton"
              onClick={() => setPage("cases")}
            >
              View all cases ↗
            </button>
          </div>

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
                {recentCases.map((c) => (
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
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Recent activity</h2>
            <Icon name="clock" />
          </div>
          <div className="activity">
            <div className="event">
              <span className="node" />
              <div>
                Report draft saved
                <small>Chest follow-up · TipTap schema v1</small>
              </div>
            </div>
            <div className="event">
              <span className="node" />
              <div>
                4 records ingested
                <small>HNSW vector + tsvector GIN index updated</small>
              </div>
            </div>
            <div className="event">
              <span className="node" />
              <div>
                Cornerstone3D WASM initialized
                <small>Hardware acceleration ready</small>
              </div>
            </div>
          </div>
          <div style={{ padding: "0 22px 20px" }}>
            <button
              type="button"
              className="btn"
              onClick={() => setPage("cases")}
            >
              Open review queue <Icon name="arrow" />
            </button>
          </div>
        </section>
      </div>
    </>
  );
}
