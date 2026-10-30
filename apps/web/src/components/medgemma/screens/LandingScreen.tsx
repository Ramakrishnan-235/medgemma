"use client";

import React from "react";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { Icon } from "../Icons";
import { Badge } from "../CommonUI";

export function LandingScreen() {
  const setPage = useWorkspaceStore((state) => state.setPage);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <main className="landing">
      {/* Marketing Navigation */}
      <nav className="marketing-nav" aria-label="Marketing navigation">
        <button
          type="button"
          onClick={() => setPage("landing")}
          className="brand text-left cursor-pointer"
          style={{ background: "none", border: 0, padding: 0 }}
          aria-label="MedGemma Home"
        >
          <span className="brandmark">+</span>
          MedGemma
        </button>
        <div className="row">
          <a
            href="#capabilities"
            onClick={(e) => {
              e.preventDefault();
              scrollTo("capabilities");
            }}
          >
            Capabilities
          </a>
          <a
            href="#workflow"
            onClick={(e) => {
              e.preventDefault();
              scrollTo("workflow");
            }}
          >
            How it works
          </a>
          <a
            href="#faq"
            onClick={(e) => {
              e.preventDefault();
              scrollTo("faq");
            }}
          >
            FAQ
          </a>
          <button
            type="button"
            className="btn black"
            onClick={() => setPage("overview")}
          >
            Open workspace <Icon name="arrow" />
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero">
        <Badge text="A considered space for clinical AI" />
        <h1>
          A clearer view
          <br />
          of every case.
        </h1>
        <p>
          Bring medical images, clinical records and thoughtful conversations into
          one calm, connected workspace.
        </p>
        <div className="row">
          <button
            type="button"
            className="btn black"
            onClick={() => setPage("overview")}
          >
            Open workspace <Icon name="arrow" />
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => scrollTo("capabilities")}
          >
            Explore capabilities
          </button>
        </div>

        {/* Hero Interactive Preview */}
        <div className="hero-preview">
          <div className="preview-top">
            <b>+ &nbsp; MedGemma Workspace</b>
            <span>
              Case 024 &nbsp; <Badge text="Demo" variant="soft" />
            </span>
          </div>
          <div className="preview-body">
            <aside className="preview-nav">
              <b style={{ color: "var(--ink)" }}>◫ Overview</b>
              <br />
              ▱ Cases
              <br />
              ◌ Assistant
              <br />
              ⊕ Medical imaging
              <br />
              ≡ Clinical text
              <br />
              ▤ Documents
            </aside>
            <div className="preview-content">
              <span className="eyebrow" style={{ fontSize: "8px" }}>
                YOUR WORKSPACE
              </span>
              <h2 style={{ marginTop: "8px" }}>
                A little clarity for the work ahead.
              </h2>
              <div className="preview-mini">
                <div>
                  Active cases<strong>12</strong>
                </div>
                <div>
                  Awaiting review<strong>04</strong>
                </div>
                <div>
                  Report drafts<strong>08</strong>
                </div>
              </div>
              <div
                className="row between"
                style={{
                  fontSize: "10px",
                  padding: "10px 0",
                  borderTop: "1px solid var(--line)",
                }}
              >
                <b>Chest follow-up</b>
                <Badge text="Needs review" variant="dark" />
              </div>
              <div
                className="row between"
                style={{
                  fontSize: "10px",
                  padding: "10px 0",
                  borderTop: "1px solid var(--line)",
                }}
              >
                <b>Record synthesis</b>
                <Badge text="Draft ready" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Capabilities Section */}
      <section id="capabilities" className="marketing-section">
        <div className="section-title">
          <h2>
            Complex information.
            <br />A considered workflow.
          </h2>
          <p>
            Purposeful tools, connected by the case. Designed for clarity at
            every step.
          </p>
        </div>

        {[
          {
            num: "01",
            title: "Explore medical images",
            desc: "Image analysis, 3D workspace layouts, anatomical localization and longitudinal comparison.",
            target: "imaging" as const,
          },
          {
            num: "02",
            title: "Understand the clinical story",
            desc: "Reason through text, summarize records, extract document data and ask focused medical questions.",
            target: "reasoning" as const,
          },
          {
            num: "03",
            title: "Bring it all together",
            desc: "Conversations, source-linked evidence and editable report drafts in a single workspace.",
            target: "report" as const,
          },
        ].map((item) => (
          <div key={item.num} className="capability">
            <span>{item.num}</span>
            <button
              type="button"
              className="btn ghost"
              style={{
                justifyContent: "flex-start",
                padding: 0,
                whiteSpace: "normal",
                textAlign: "left",
              }}
              onClick={() => setPage(item.target)}
              aria-label={`Navigate to ${item.title}`}
            >
              <h3>{item.title}</h3>
            </button>
            <p>{item.desc}</p>
          </div>
        ))}
      </section>

      {/* Workflow Section */}
      <section
        id="workflow"
        className="marketing-section"
        style={{ borderTop: "1px solid var(--line)" }}
      >
        <div className="section-title">
          <h2>
            Less searching.
            <br />
            More understanding.
          </h2>
          <span className="eyebrow">A CONNECTED WORKFLOW</span>
        </div>
        <div className="steps">
          <div>
            <span>01 / GATHER</span>
            <h3>Start with the case.</h3>
            <p>Bring together the relevant studies, records and notes.</p>
          </div>
          <div>
            <span>02 / EXPLORE</span>
            <h3>Work with the evidence.</h3>
            <p>Inspect the source, ask questions and keep context visible.</p>
          </div>
          <div>
            <span>03 / REVIEW</span>
            <h3>Shape a considered draft.</h3>
            <p>
              Review, edit and connect the output to its supporting material.
            </p>
          </div>
        </div>
      </section>

      {/* Principles Section */}
      <section className="marketing-section" style={{ paddingTop: "20px" }}>
        <div className="principles">
          <h2>
            Clarity includes
            <br />
            knowing the limits.
          </h2>
          <div>
            <p>
              Visible sources. Explicit uncertainty. Editable drafts. A review
              step before outputs become part of a clinical workflow.
            </p>
            <p style={{ marginTop: "16px" }}>
              This interface concept uses fictional records and schematic
              images. Clinical capabilities require separate implementation and
              validation.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="marketing-section">
        <div className="section-title">
          <h2>A few useful answers.</h2>
        </div>
        <div className="faq">
          <details>
            <summary>What belongs in a case workspace?</summary>
            <p>
              Related image studies, clinical notes, extracted fields,
              conversations and report drafts, with links back to their sources.
            </p>
          </details>
          <details>
            <summary>How are AI outputs presented?</summary>
            <p>
              As reviewable drafts with evidence, missing context and
              uncertainty visible alongside the result.
            </p>
          </details>
          <details>
            <summary>Is this a working clinical application?</summary>
            <p>
              This deliverable is an interactive UI design. It connects to the
              MedGemma framework and offline inference pipelines.
            </p>
          </details>
        </div>
      </section>

      {/* Marketing Footer */}
      <footer className="footer">
        <div className="footer-inner">
          <h2>Make space for clarity.</h2>
          <button
            type="button"
            className="btn"
            onClick={() => setPage("overview")}
          >
            Explore the workspace <Icon name="arrow" />
          </button>
          <div className="footer-bottom">
            <span>+ MedGemma Workspace</span>
            <span>UI concept · October 2026</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
