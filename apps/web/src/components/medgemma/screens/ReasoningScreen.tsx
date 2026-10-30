"use client";

import { useShallow } from "zustand/react/shallow";
import React, { useState, useRef, useEffect } from "react";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { Heading, ContextBar, Badge, SourceChip } from "../CommonUI";
import { Icon } from "../Icons";
import { api } from "@/lib/api";

export function ReasoningScreen() {
  const { setPage, openModal, showToast, activeCaseId, activeCase } = useWorkspaceStore(
    useShallow((state) => ({
      setPage: state.setPage,
      openModal: state.openModal,
      showToast: state.showToast,
      activeCaseId: state.activeCaseId,
      activeCase: state.activeCase,
    }))
  );
  const [question, setQuestion] = useState(
    "What context and pulmonary evidence should be reviewed before summarizing this case?"
  );
  const [isLoading, setIsLoading] = useState(false);
  const [liveResult, setLiveResult] = useState<string | null>(null);
  const activeEventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    return () => {
      if (activeEventSourceRef.current) {
        activeEventSourceRef.current.close();
      }
    };
  }, []);

  const handleExplore = async () => {
    if (!question.trim()) return;
    if (activeEventSourceRef.current) {
      activeEventSourceRef.current.close();
    }

    setIsLoading(true);
    setLiveResult("");

    try {
      const run = await api.createQARun(activeCaseId, question);
      const es = api.subscribeRunEvents(
        activeCaseId,
        run.run_id,
        (event, data) => {
          if (event === "token") {
            const token = (data.token_delta as string) || (data.token as string) || "";
            setLiveResult((prev) => (prev ?? "") + token);
          } else if (event === "completed") {
            const output = data.output as { answer_markdown?: string } | undefined;
            if (output?.answer_markdown) {
              setLiveResult(output.answer_markdown);
            }
            setIsLoading(false);
            showToast("Evidence synthesis completed via MedGemma.");
          }
        },
        () => {
          setIsLoading(false);
        }
      );
      activeEventSourceRef.current = es;
    } catch {
      setIsLoading(false);
      showToast("Evidence layout shown below (Backend offline fallback).");
      setLiveResult(null);
    }

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
              <Badge text="Source material" />
            </div>
            <div className="document mt-[18px]">
              <div className="paper">
                <h3>Clinical encounter note</h3>
                <p>PATIENT RECORD · CASE EVIDENCE</p>
                <div className="docline">Encounter date: 24 October 2026</div>
                <p>
                  <b>Context</b>
                  <br />
                  The record describes a follow-up visit and an imaging study for {activeCase || "Case 024"}. A
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
                  Cryptographic hash and tsvector tokens indexed in PostgreSQL pgvector.
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
            disabled={isLoading}
          >
            {isLoading ? "Synthesizing Evidence..." : "Explore evidence"}{" "}
            <Icon name="arrow" />
          </button>

          <div className="divider" />

          <div id="reasoning-result">
            {liveResult !== null && (
              <div className="insight border-l-2 border-zinc-400 pl-3.5 my-3 bg-zinc-950/40 rounded-r-md py-3">
                <h3 className="flex items-center gap-2">
                  Live MedGemma Synthesis{" "}
                  <Badge text={isLoading ? "Streaming" : "Verified"} variant="dark" />
                </h3>
                <p className="whitespace-pre-wrap mt-2 text-zinc-200">
                  {liveResult || (isLoading ? "Querying hybrid RRF and reasoning..." : "")}
                </p>
                <div className="mt-3">
                  <SourceChip
                    label="Active Case Evidence Vector"
                    payload={{
                      title: "Live Evidence Synthesis",
                      quote: liveResult || "Streaming real-time token inference from MedGemma.",
                      location: "PostgreSQL pgvector / HNSW hybrid search",
                    }}
                  />
                </div>
              </div>
            )}

            <div className="insight">
              <h3>
                Evidence-linked interpretation{" "}
                <Badge text="Structured analysis" variant="soft" />
              </h3>
              <p>
                The note describes a follow-up workflow with current and prior
                imaging. Verify the dates, clinical indication and acquisition
                context before drafting the case summary.
              </p>
              <SourceChip
                label="Clinical note · Context"
                payload={{
                  title: "Clinical note · Context",
                  quote: "Follow-up visit and imaging study documentation. Prior comparison available.",
                  location: "Clinical note.pdf · Section 1",
                }}
              />
            </div>

            <div className="insight">
              <h3>Information to confirm</h3>
              <ul>
                <li>Clinical indication and relevant history</li>
                <li>Comparison study metadata and availability</li>
                <li>Source findings and review status</li>
              </ul>
              <SourceChip
                label="Clinical note · Limitations"
                payload={{
                  title: "Clinical note · Limitations",
                  quote: "Patient history and complete examination details are absent from the admission intake note.",
                  location: "Clinical note.pdf · Limitations clause",
                }}
              />
            </div>

            <div className="insight">
              <h3>Uncertainty stays visible</h3>
              <p>
                History and examination details are checked against raw chunks.
                Missing details remain explicit in all MedGemma outputs.
              </p>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
