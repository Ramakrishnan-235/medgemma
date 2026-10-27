"use client";

import { useShallow } from "zustand/react/shallow";

import React from "react";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { Heading, Badge } from "../CommonUI";
import { Icon } from "../Icons";

export function CaseDetailScreen() {
  const { setPage, openModal } = useWorkspaceStore(
    useShallow((state) => ({
      setPage: state.setPage,
      openModal: state.openModal,
    })),
  );

  return (
    <>
      <Heading
        eyebrow="CASE 024 / DEMO"
        title="Chest follow-up"
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
          <small>Adult · De-identified demo · Created 21 Oct 2026</small>
        </div>
        <Badge text="Needs review" variant="dark" />
      </div>

      <div className="cols">
        {/* Left Column Stack */}
        <div className="stack">
          {/* Files & Studies */}
          <section className="panel">
            <div className="panel-head">
              <h2>Files & studies</h2>
              <button
                type="button"
                className="btn"
                onClick={() => openModal("upload")}
              >
                <Icon name="plus" /> Add file
              </button>
            </div>
            <div className="panel-pad">
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
            </div>
          </section>

          {/* Case Outputs */}
          <section className="panel">
            <div className="panel-head">
              <h2>Case outputs</h2>
              <Badge text="2 drafts" />
            </div>
            <div className="panel-pad">
              <div className="listitem">
                <div>
                  <p>Chest imaging report</p>
                  <small>AI draft · Last edited today</small>
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
                  <small>Source-linked · Review pending</small>
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
