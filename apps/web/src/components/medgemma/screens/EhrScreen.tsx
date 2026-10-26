"use client";

import React from "react";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { Heading, ContextBar, Badge, SourceChip } from "../CommonUI";
import { Icon } from "../Icons";

export function EhrScreen() {
  const { ehrTab, setEhrTab, setPage, showToast } = useWorkspaceStore();

  const handleRefresh = () => {
    showToast("Summary layout refreshed. No record processing was performed.");
  };

  return (
    <>
      <Heading
        eyebrow="CLINICAL TEXT / EHR"
        title="The record, brought together."
        desc="A concise view of the clinical story, linked to its sources."
        actions={
          <button type="button" className="btn black" onClick={handleRefresh}>
            <Icon name="text" /> Refresh summary
          </button>
        }
      />

      <ContextBar />

      {/* Tabs Header */}
      <div className="toolbar tabline">
        <div className="tabs" aria-label="EHR view tabs">
          {(["Overview", "Timeline", "Sources"] as const).map((t) => (
            <button
              key={t}
              type="button"
              className={ehrTab === t ? "selected" : ""}
              onClick={() => setEhrTab(t)}
            >
              {t}
            </button>
          ))}
        </div>
        <Badge text="Summary draft · Review pending" variant="dash" />
      </div>

      {ehrTab === "Timeline" && (
        <section className="panel panel-pad">
          <h2>Clinical timeline</h2>
          <div className="activity" style={{ padding: "12px 0" }}>
            <div className="event">
              <span className="node" />
              <div>
                24 Oct 2026 · Follow-up encounter
                <small>Clinical note · Current imaging attached</small>
                <div style={{ marginTop: 6 }}>
                  <SourceChip label="Encounter note · p. 1" />
                </div>
              </div>
            </div>
            <div className="event">
              <span className="node" />
              <div>
                21 Jul 2026 · Prior study
                <small>Imaging metadata · Demo</small>
                <div style={{ marginTop: 6 }}>
                  <SourceChip label="Prior study" />
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {ehrTab === "Sources" && (
        <section className="panel panel-pad">
          <h2>Record sources</h2>
          {[
            ["Encounter note.pdf", "24 Oct 2026 · 1 page"],
            ["Imaging metadata.json", "24 Oct 2026 · Current and prior"],
            ["Lab report.pdf", "22 Oct 2026 · 1 page"],
          ].map(([n, m]) => (
            <div key={n} className="listitem">
              <div>
                <p>{n}</p>
                <small>{m}</small>
              </div>
              <SourceChip label="Inspect source" />
            </div>
          ))}
        </section>
      )}

      {ehrTab === "Overview" && (
        <div className="cols">
          <div className="stack">
            {/* Overview Narrative Card */}
            <section className="panel panel-pad">
              <div className="row between">
                <h2>Case overview</h2>
                <Badge text="Source-linked" variant="soft" />
              </div>
              <p
                className="muted"
                style={{ fontSize: "12px", lineHeight: 1.9, marginTop: "16px" }}
              >
                The demo record contains a follow-up encounter, current imaging
                and a prior comparison study. The source set is incomplete;
                history and examination details need to be confirmed before the
                summary is used.
              </p>
              <div className="row" style={{ marginTop: "12px" }}>
                <SourceChip label="Encounter note · p. 1" />
                <SourceChip label="Study metadata" />
              </div>
            </section>

            {/* Structured EHR Grid */}
            <div className="ehrgrid">
              <section className="panel">
                <div className="row between">
                  <h3>Problems & context</h3>
                  <Icon name="text" />
                </div>
                <p>
                  Follow-up review documented.
                  <br />
                  Diagnosis details: not provided.
                </p>
                <div style={{ marginTop: 8 }}>
                  <SourceChip label="Encounter note" />
                </div>
              </section>

              <section className="panel">
                <div className="row between">
                  <h3>Medications</h3>
                  <Icon name="file" />
                </div>
                <p>No medication list is included in the sample source set.</p>
                <div style={{ marginTop: 8 }}>
                  <Badge text="Not provided" variant="dash" />
                </div>
              </section>

              <section className="panel">
                <div className="row between">
                  <h3>Allergies</h3>
                  <Icon name="shield" />
                </div>
                <p>
                  Allergy status is not provided. This does not mean “no known
                  allergies.”
                </p>
                <div style={{ marginTop: 8 }}>
                  <Badge text="Unknown" variant="dash" />
                </div>
              </section>

              <section className="panel">
                <div className="row between">
                  <h3>Recent encounters</h3>
                  <Icon name="clock" />
                </div>
                <p>
                  24 Oct 2026 · Follow-up
                  <br />
                  21 Jul 2026 · Prior imaging
                </p>
                <div style={{ marginTop: 8 }}>
                  <SourceChip label="Timeline sources" />
                </div>
              </section>
            </div>
          </div>

          {/* Right Aside: Source Coverage Checklist */}
          <aside className="panel panel-pad">
            <h2>Source coverage</h2>
            <div className="listitem">
              <div>
                <p>Encounter note</p>
                <small>1 document · Demo</small>
              </div>
              <Icon name="check" />
            </div>
            <div className="listitem">
              <div>
                <p>Imaging metadata</p>
                <small>2 studies · Demo</small>
              </div>
              <Icon name="check" />
            </div>
            <div className="listitem">
              <div>
                <p>Medication history</p>
                <small>Missing from sources</small>
              </div>
              <span className="muted">—</span>
            </div>
            <div className="listitem">
              <div>
                <p>Allergy history</p>
                <small>Missing from sources</small>
              </div>
              <span className="muted">—</span>
            </div>
            <div className="note" style={{ marginTop: "20px" }}>
              “Not provided” and “explicitly absent” are different states.
            </div>
            <button
              type="button"
              className="btn w-full"
              style={{ marginTop: "16px" }}
              onClick={() => setPage("extraction")}
            >
              <Icon name="plus" /> Add a document
            </button>
          </aside>
        </div>
      )}
    </>
  );
}
