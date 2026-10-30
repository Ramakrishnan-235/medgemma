"use client";

import { useShallow } from "zustand/react/shallow";
import React, { useState, useRef, useEffect } from "react";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { Heading, ContextBar, Badge, SourceChip } from "../CommonUI";
import { Icon } from "../Icons";
import { api } from "@/lib/api";

export function EhrScreen() {
  const { ehrTab, setEhrTab, setPage, showToast, activeCaseId } = useWorkspaceStore(
    useShallow((state) => ({
      ehrTab: state.ehrTab,
      setEhrTab: state.setEhrTab,
      setPage: state.setPage,
      showToast: state.showToast,
      activeCaseId: state.activeCaseId,
    }))
  );

  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryData, setSummaryData] = useState<Record<string, unknown> | null>(null);
  const activeEventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    return () => {
      if (activeEventSourceRef.current) {
        activeEventSourceRef.current.close();
      }
    };
  }, []);

  const handleRefresh = async () => {
    if (activeEventSourceRef.current) {
      activeEventSourceRef.current.close();
    }
    setIsSummarizing(true);
    try {
      const run = await api.triggerEhrSummary(activeCaseId);
      showToast("Queued two-pass grounded EHR clinical summarization in Celery.");
      const es = api.subscribeRunEvents(
        activeCaseId,
        run.run_id,
        (event, data) => {
          if (event === "snapshot" || event === "completed") {
            if (data.output_json) {
              setSummaryData(data.output_json as Record<string, unknown>);
            }
            setIsSummarizing(false);
            showToast("Two-pass grounded EHR summary ready.");
          }
        },
        () => setIsSummarizing(false)
      );
      activeEventSourceRef.current = es;
    } catch (err) {
      setIsSummarizing(false);
      showToast(`EHR trigger fallback: ${(err as Error).message}`);
    }
  };

  const narrativeText =
    (summaryData?.overview as string) ||
    (summaryData?.narrative as string) ||
    "The demo record contains a follow-up encounter, current imaging and a prior comparison study. The source set is incomplete; history and examination details need to be confirmed before the summary is used.";

  const problemsText =
    (summaryData?.problems as string) ||
    "Follow-up review documented.\nDiagnosis details: not provided.";

  const medicationsText =
    (summaryData?.medications as string) ||
    "No medication list is included in the sample source set.";

  const allergiesText =
    (summaryData?.allergies as string) ||
    "Allergy status is not provided. This does not mean “no known allergies.”";

  const encountersText =
    (summaryData?.encounters as string) ||
    "24 Oct 2026 · Follow-up\n21 Jul 2026 · Prior imaging";

  return (
    <>
      <Heading
        eyebrow="CLINICAL TEXT / EHR"
        title="The record, brought together."
        desc="A concise view of the clinical story, linked to its sources."
        actions={
          <button
            type="button"
            className="btn black"
            onClick={handleRefresh}
            disabled={isSummarizing}
          >
            <Icon name="text" /> {isSummarizing ? "Summarizing..." : "Refresh summary"}
          </button>
        }
      />

      <ContextBar />

      {/* Tabs Header */}
      <div className="toolbar tabline">
        <div className="tabs" aria-label="EHR view tabs" role="tablist">
          {(["Overview", "Timeline", "Sources"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={ehrTab === t}
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
          <div className="activity py-3">
            <div className="event">
              <span className="node" />
              <div>
                24 Oct 2026 · Follow-up encounter
                <small>Clinical note · Current imaging attached</small>
                <div className="mt-1.5">
                  <SourceChip
                    label="Encounter note · p. 1"
                    payload={{
                      title: "Encounter note · p. 1",
                      quote: "Patient attended 24 Oct 2026 follow-up for thoracic imaging evaluation.",
                      location: "Encounter note.pdf · Page 1",
                    }}
                  />
                </div>
              </div>
            </div>
            <div className="event">
              <span className="node" />
              <div>
                21 Jul 2026 · Prior study
                <small>Imaging metadata · Demo</small>
                <div className="mt-1.5">
                  <SourceChip
                    label="Prior study"
                    payload={{
                      title: "Prior study",
                      quote: "Baseline chest CT study acquired 21 Jul 2026 (Series 01).",
                      location: "Imaging metadata · DICOM study 024-prior",
                    }}
                  />
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
              <SourceChip
                label="Inspect source"
                payload={{
                  title: n,
                  quote: `Authoritative clinical record: ${n} (${m})`,
                  location: `S3 storage / cases/${activeCaseId}/sources`,
                }}
              />
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
                <Badge text={summaryData ? "Grounded AI synthesis" : "Source-linked"} variant="soft" />
              </div>
              <p className="muted text-[12px] leading-[1.9] mt-4 whitespace-pre-wrap">
                {narrativeText}
              </p>
              <div className="row mt-3">
                <SourceChip
                  label="Encounter note · p. 1"
                  payload={{
                    title: "Encounter note · p. 1",
                    quote: "Follow-up visit documented. Indication requires confirmation with patient chart.",
                    location: "Encounter note.pdf · Page 1",
                  }}
                />
                <SourceChip
                  label="Study metadata"
                  payload={{
                    title: "Study metadata",
                    quote: "Two chest imaging acquisitions: 24 Oct 2026 and 21 Jul 2026.",
                    location: "DICOM Study Metadata Registry",
                  }}
                />
              </div>
            </section>

            {/* Structured EHR Grid */}
            <div className="ehrgrid">
              <section className="panel">
                <div className="row between">
                  <h3>Problems & context</h3>
                  <Icon name="text" />
                </div>
                <p className="whitespace-pre-wrap">{problemsText}</p>
                <div className="mt-2">
                  <SourceChip
                    label="Encounter note"
                    payload={{
                      title: "Problems & context",
                      quote: problemsText,
                      location: "Encounter note · Section: Reason for review",
                    }}
                  />
                </div>
              </section>

              <section className="panel">
                <div className="row between">
                  <h3>Medications</h3>
                  <Icon name="file" />
                </div>
                <p className="whitespace-pre-wrap">{medicationsText}</p>
                <div className="mt-2">
                  <Badge text="Not provided" variant="dash" />
                </div>
              </section>

              <section className="panel">
                <div className="row between">
                  <h3>Allergies</h3>
                  <Icon name="shield" />
                </div>
                <p className="whitespace-pre-wrap">{allergiesText}</p>
                <div className="mt-2">
                  <Badge text="Unknown" variant="dash" />
                </div>
              </section>

              <section className="panel">
                <div className="row between">
                  <h3>Recent encounters</h3>
                  <Icon name="clock" />
                </div>
                <p className="whitespace-pre-wrap">{encountersText}</p>
                <div className="mt-2">
                  <SourceChip
                    label="Timeline sources"
                    payload={{
                      title: "Recent encounters",
                      quote: encountersText,
                      location: "EHR Encounter History Index",
                    }}
                  />
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
            <div className="note mt-5">
              “Not provided” and “explicitly absent” are different states.
            </div>
            <button
              type="button"
              className="btn full justify-center mt-4"
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
