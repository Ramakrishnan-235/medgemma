"use client";

import { useShallow } from "zustand/react/shallow";

import React, { useState } from "react";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { Heading, ContextBar, Badge, SourceChip } from "../CommonUI";
import { Icon } from "../Icons";

export function ReasoningScreen() {
  const { setPage, openModal, showToast } = useWorkspaceStore(
    useShallow((state) => ({
      setPage: state.setPage,
      openModal: state.openModal,
      showToast: state.showToast,
    })),
  );
  const [question, setQuestion] = useState(
    "What context should be reviewed before summarizing this case?"
  );

  const handleExplore = () => {
    showToast(
      "Evidence layout shown below. This prototype does not run clinical inference."
    );
    document
      .getElementById("reasoning-result")
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };

  return (
    <>
      <Heading
        eyebrow="CLINICAL TEXT / REASONING"
        title="Read beyond the words."
        desc="Explore a clinical question with its supporting evidence."
        actions={
          <button
            type="button"
            className="btn"
            onClick={() => setPage("ehr")}
          >
            <Icon name="arrow" /> View EHR summary
          </button>
        }
      />

      <ContextBar />

      <div className="cols equal">
        {/* Left Column: Source Encounter Note Paper */}
        <section className="panel">
          <div className="panel-head">
            <h2>Source material</h2>
            <button
              type="button"
              className="btn"
              onClick={() => openModal("upload")}
            >
              <Icon name="plus" /> Add source
            </button>
          </div>
          <div className="panel-pad">
            <div className="row between">
              <span className="small">Clinical note.pdf</span>
              <Badge text="Demo source" />
            </div>
            <div className="document" style={{ marginTop: "18px" }}>
              <div className="paper">
                <h3>Clinical encounter note</h3>
                <p>CASE 024 · FICTIONAL EXAMPLE</p>
                <div className="docline">Encounter date: 24 October 2026</div>
                <p>
                  <b>Context</b>
                  <br />
                  The record describes a follow-up visit and an imaging study. A
                  prior study is available for comparison.
                </p>
                <p>
                  <b>Reason for review</b>
                  <br />
                  Bring the documented timeline, imaging context and missing
                  information together before drafting a summary.
                </p>
                <p>
                  <b>Source limitations</b>
                  <br />
                  This note is an interface sample. Patient history and
                  examination details are not provided.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Right Column: Question & Evidence-linked Reasoning */}
        <section className="panel panel-pad">
          <label className="field">
            Clinical question
            <textarea
              id="reasoning-question"
              placeholder="What would you like to understand?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
          </label>

          <button
            type="button"
            className="btn black"
            onClick={handleExplore}
          >
            Explore evidence <Icon name="arrow" />
          </button>

          <div className="divider" />

          <div id="reasoning-result">
            <div className="insight">
              <h3>
                Evidence-linked interpretation{" "}
                <Badge text="UI sample" variant="soft" />
              </h3>
              <p>
                The note describes a follow-up workflow with current and prior
                imaging. Verify the dates, clinical indication and acquisition
                context before drafting the case summary.
              </p>
              <SourceChip label="Clinical note · Context" />
            </div>

            <div className="insight">
              <h3>Information to confirm</h3>
              <ul>
                <li>Clinical indication and relevant history</li>
                <li>Comparison study metadata and availability</li>
                <li>Source findings and review status</li>
              </ul>
              <SourceChip label="Clinical note · Limitations" />
            </div>

            <div className="insight">
              <h3>Uncertainty stays visible</h3>
              <p>
                History and examination details are not provided in this sample.
                Missing details should remain explicit in the output.
              </p>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
