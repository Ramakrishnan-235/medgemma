"use client";

import { useShallow } from "zustand/react/shallow";

import React, { useState } from "react";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { Heading, Badge, SourceChip } from "../CommonUI";
import { Icon } from "../Icons";

export function QaScreen() {
  const { qaAnswer, setQaAnswer, setPage, showToast } = useWorkspaceStore(
    useShallow((state) => ({
      qaAnswer: state.qaAnswer,
      setQaAnswer: state.setQaAnswer,
      setPage: state.setPage,
      showToast: state.showToast,
    })),
  );
  const [qaInput, setQaInput] = useState(
    "What information is missing from this demo record?"
  );

  const handleAsk = (e: React.FormEvent) => {
    e.preventDefault();
    setQaAnswer(true);
  };

  return (
    <>
      <Heading
        eyebrow="ASSISTANT / MEDICAL Q&A"
        title="Medical question answering"
        desc="Ask with context. Review with evidence."
        actions={
          <button
            type="button"
            className="btn"
            onClick={() => setPage("chat")}
          >
            <Icon name="chat" /> General chat
          </button>
        }
      />

      <div className="qa-head">
        <span className="eyebrow">A FOCUSED SPACE FOR QUESTIONS</span>
        <h2 style={{ marginTop: "14px" }}>What would you like to understand?</h2>
        <p>Choose the source scope and keep the answer close to the evidence.</p>
      </div>

      <div className="question">
        <form id="qa-form" className="composer" onSubmit={handleAsk}>
          <label className="field">
            Your question
            <textarea
              id="qa-input"
              placeholder="Ask a medical question..."
              value={qaInput}
              onChange={(e) => setQaInput(e.target.value)}
            />
          </label>

          <div className="row between">
            <select className="case-picker" aria-label="Question source scope">
              <option>Attached case sources only</option>
              <option>General knowledge · Unverified</option>
            </select>
            <button type="submit" className="btn black">
              Ask question <Icon name="arrow" />
            </button>
          </div>
        </form>

        {qaAnswer ? (
          <section className="panel qa-answer">
            <div className="message-label">
              Answer preview <Badge text="Demo · Review required" variant="dash" />
            </div>

            <div className="insight">
              <h3>Missing from the source set</h3>
              <p>
                The demonstration record does not include a complete history,
                examination, medication list or allergy history. These should be
                labeled as missing rather than inferred.
              </p>
              <div className="row" style={{ marginTop: 8 }}>
                <SourceChip label="Clinical note · Limitations" />
                <SourceChip label="EHR · Source coverage" />
              </div>
            </div>

            <div className="insight">
              <h3>Scope and limitations</h3>
              <p>
                This is a fixed interface example. No inference or external
                literature search was performed.
              </p>
            </div>

            <div className="row" style={{ marginTop: "20px" }}>
              <button
                type="button"
                className="btn"
                onClick={() => setPage("ehr")}
              >
                Review record sources <Icon name="arrow" />
              </button>
              <button
                type="button"
                className="btn"
                onClick={() =>
                  showToast("Saved in this design preview. No backend is connected.")
                }
              >
                <Icon name="folder" /> Save to case
              </button>
            </div>
          </section>
        ) : (
          <div className="suggestions">
            <button
              type="button"
              className="suggestion"
              onClick={() => {
                setQaInput("Which sources are available for this case?");
              }}
            >
              Inspect available evidence
              <small>Start with the source set</small>
            </button>
            <button
              type="button"
              className="suggestion"
              onClick={() => {
                setQaInput(
                  "What information is missing from this demo record?"
                );
              }}
            >
              Find missing information
              <small>Keep the limitations visible</small>
            </button>
          </div>
        )}
      </div>
    </>
  );
}
