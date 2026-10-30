"use client";

import { useShallow } from "zustand/react/shallow";
import React, { useEffect, useState } from "react";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { Heading, Badge } from "../CommonUI";
import { Icon } from "../Icons";
import { api, type ApiCaseDetail, type ApiSourceFile } from "@/lib/api";

export function CaseDetailScreen() {
  const {
    activeCase,
    activeCaseId,
    setPage,
    openModal,
    setActiveSourceId,
    showToast,
  } = useWorkspaceStore(
    useShallow((state) => ({
      activeCase: state.activeCase,
      activeCaseId: state.activeCaseId,
      setPage: state.setPage,
      openModal: state.openModal,
      setActiveSourceId: state.setActiveSourceId,
      showToast: state.showToast,
    }))
  );

  const [caseDetail, setCaseDetail] = useState<ApiCaseDetail | null>(null);
  const [sources, setSources] = useState<ApiSourceFile[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      if (!activeCaseId) return;
      setLoading(true);
      try {
        const detail = await api.getCaseDetail(activeCaseId);
        if (isMounted && detail) {
          setCaseDetail(detail);
          setSources(detail.source_files || []);
        }
      } catch {
        // Backend offline or mock case - fallback
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, [activeCaseId]);

  const handleOpenSource = (source: ApiSourceFile) => {
    setActiveSourceId(source.id);
    if (
      source.file_kind === "dicom" ||
      source.file_kind === "image_png" ||
      source.file_kind === "image_jpeg"
    ) {
      showToast(`Selected imaging study: ${source.filename}`);
      setPage("imaging");
    } else {
      showToast(`Selected document source: ${source.filename}`);
      setPage("ehr");
    }
  };

  return (
    <>
      <Heading
        eyebrow={`CASE ID: ${activeCaseId ? (activeCaseId.length > 8 ? activeCaseId.slice(0, 8) : activeCaseId) : "024"}`}
        title={activeCase || "Chest follow-up"}
        desc="A connected view of this case, from source to draft."
        actions={
          <>
            <button
              type="button"
              className="btn"
              onClick={() => setPage("chat")}
            >
              <Icon name="chat" /> Open in chat
            </button>
            <button
              type="button"
              className="btn black"
              onClick={() => setPage("imaging")}
            >
              <Icon name="scan" /> Review study
            </button>
          </>
        }
      />

      {/* Case Context Banner */}
      <div className="context">
        <div>
          <p>
            <b>Case context</b>
          </p>
          <small>
            {caseDetail
              ? `Patient: ${caseDetail.patient_code} · Created ${new Date(caseDetail.created_at).toLocaleDateString()} · ${sources.length} sources`
              : "Adult · De-identified context · Active clinical workspace"}
          </small>
        </div>
        <Badge
          text={caseDetail?.status || "Needs review"}
          variant={caseDetail?.status === "Reviewed" ? "soft" : "dark"}
        />
      </div>

      {/* 6-tile Patient Vitals Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 mb-5">
        {[
          { label: "Heart Rate", val: "72", unit: "bpm", note: "Sinus rhythm" },
          { label: "Blood Pressure", val: "128/82", unit: "mmHg", note: "Sitting, R" },
          { label: "SpO2", val: "97%", unit: "O2", note: "Room air" },
          { label: "Resp Rate", val: "16", unit: "/min", note: "Unlabored" },
          { label: "Temperature", val: "36.8°", unit: "C", note: "Oral" },
          { label: "Acuity Status", val: "Stable", unit: "", isBadge: true },
        ].map((v) => (
          <div key={v.label} className="panel p-3 text-left">
            <span className="eyebrow block text-[10px] text-zinc-400 mb-1">{v.label}</span>
            {v.isBadge ? (
              <div className="mt-1">
                <Badge text={v.val} variant="soft" />
              </div>
            ) : (
              <div className="flex items-baseline gap-1">
                <strong className="text-base font-semibold text-zinc-100">{v.val}</strong>
                <small className="text-[10px] text-zinc-400">{v.unit}</small>
              </div>
            )}
            {v.note && <small className="block text-[10px] text-zinc-500 mt-0.5">{v.note}</small>}
          </div>
        ))}
      </div>

      <div className="cols">
        {/* Left Column Stack */}
        <div className="stack">
          {/* Files & Studies */}
          <section className="panel">
            <div className="panel-head">
              <h2>Files & studies {loading && <small className="muted">(refreshing...)</small>}</h2>
              <button
                type="button"
                className="btn"
                onClick={() => openModal("upload")}
              >
                <Icon name="plus" /> Add file
              </button>
            </div>
            <div className="panel-pad">
              {sources.length > 0 ? (
                sources.map((s) => (
                  <div key={s.id} className="listitem">
                    <div className="row">
                      <span className="fileicon">
                        <Icon name={s.file_kind.includes("image") || s.file_kind === "dicom" ? "scan" : "file"} />
                      </span>
                      <div>
                        <p>{s.filename}</p>
                        <small>
                          {s.file_kind.toUpperCase()} · {(s.byte_size / 1024).toFixed(0)} KB · Status: {s.parse_status}
                        </small>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => handleOpenSource(s)}
                    >
                      Open <Icon name="arrow" />
                    </button>
                  </div>
                ))
              ) : (
                <>
                  {[
                    {
                      icon: "scan",
                      name: "CT chest · Current",
                      meta: "24 Oct 2026 · Series 01 · Demo",
                      target: "imaging" as const,
                    },
                    {
                      icon: "scan",
                      name: "CT chest · Prior",
                      meta: "21 Jul 2026 · Series 01 · Demo",
                      target: "compare" as const,
                    },
                    {
                      icon: "file",
                      name: "Clinical note.pdf",
                      meta: "1 page · Added today",
                      target: "reasoning" as const,
                    },
                  ].map((item) => (
                    <div key={item.name} className="listitem">
                      <div className="row">
                        <span className="fileicon">
                          <Icon name={item.icon} />
                        </span>
                        <div>
                          <p>{item.name}</p>
                          <small>{item.meta}</small>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => setPage(item.target)}
                      >
                        Open <Icon name="arrow" />
                      </button>
                    </div>
                  ))}
                </>
              )}
            </div>
          </section>

          {/* Case Outputs */}
          <section className="panel">
            <div className="panel-head">
              <h2>Case outputs</h2>
              <Badge text="2 drafts" variant="soft" />
            </div>
            <div className="panel-pad">
              <div className="listitem">
                <div>
                  <p>Chest imaging report</p>
                  <small>AI draft · Versioned with TipTap schema</small>
                </div>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setPage("report")}
                >
                  <Icon name="report" /> Continue editing
                </button>
              </div>
              <div className="listitem">
                <div>
                  <p>Clinical record summary</p>
                  <small>Source-linked · Verifiable evidence citations</small>
                </div>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setPage("ehr")}
                >
                  <Icon name="text" /> Review summary
                </button>
              </div>
            </div>
          </section>
        </div>

        {/* Right Column: Case Timeline */}
        <section className="panel">
          <div className="panel-head">
            <h2>Case timeline</h2>
            <Icon name="clock" />
          </div>
          <div className="activity">
            <div className="event">
              <span className="node" />
              <div>
                Current study attached
                <small>24 Oct 2026 · 09:42</small>
              </div>
            </div>
            <div className="event">
              <span className="node" />
              <div>
                Clinical note added
                <small>24 Oct 2026 · 09:30</small>
              </div>
            </div>
            <div className="event">
              <span className="node" />
              <div>
                Prior study attached
                <small>21 Jul 2026</small>
              </div>
            </div>
            <div className="event">
              <span className="node" />
              <div>
                Case created
                <small>21 Jul 2026</small>
              </div>
            </div>
          </div>
          <div className="panel-pad">
            <div className="note">
              Every output stays linked to its source material and case context.
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
