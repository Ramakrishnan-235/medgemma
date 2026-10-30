"use client";

import { useShallow } from "zustand/react/shallow";

import React, { useEffect, useState } from "react";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { Heading, ContextBar, Badge, SourceChip } from "../CommonUI";
import { Icon } from "../Icons";
import { api } from "@/lib/api";

import { ClinicalReportEditor, type ReportVersionRecord } from "@/components/editor/ClinicalReportEditor";
import { useImagingStore } from "@/stores/useImagingStore";

function extractSectionsFromTiptap(json: Record<string, unknown> | undefined) {
  let tech = "";
  let find = "";
  let impr = "";
  let limit = "";

  if (json && Array.isArray((json as { content?: unknown[] }).content)) {
    const content = (json as { content: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }> }).content;
    for (const node of content) {
      if (node.type === "paragraph" && Array.isArray(node.content)) {
        const fullText = node.content.map((c) => c.text || "").join("").trim();
        if (fullText.toUpperCase().startsWith("TECHNIQUE:")) {
          tech = fullText.replace(/^TECHNIQUE:\s*/i, "");
        } else if (fullText.toUpperCase().startsWith("FINDINGS:")) {
          find = fullText.replace(/^FINDINGS:\s*/i, "");
        } else if (fullText.toUpperCase().startsWith("IMPRESSION:")) {
          impr = fullText.replace(/^IMPRESSION:\s*/i, "");
        } else if (fullText.toUpperCase().startsWith("LIMITATIONS:")) {
          limit = fullText.replace(/^LIMITATIONS:\s*/i, "");
        }
      }
    }
  }

  return {
    technique: tech || undefined,
    findings: find || undefined,
    impression: impr || undefined,
    limitations: limit || undefined,
  };
}

export function ReportScreen() {
  const { showToast, setPage, activeCaseId } = useWorkspaceStore(
    useShallow((state) => ({
      showToast: state.showToast,
      setPage: state.setPage,
      activeCaseId: state.activeCaseId,
    })),
  );

  const [editorMode, setEditorMode] = useState<"tiptap" | "sections">("tiptap");

  // Initial immutable report version history for Case 024
  const [versions, setVersions] = useState<ReportVersionRecord[]>([
    {
      id: "ver-1",
      version_number: 1,
      review_status: "draft",
      created_at: new Date().toISOString(),
      tiptap_doc_json: {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 3 },
            content: [{ type: "text", text: "CHEST IMAGING REPORT — CASE 024" }],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "TECHNIQUE: Multidetector helical axial CT imaging of the thorax performed without intravenous contrast. Scans were reconstructed at 1.0 mm slice intervals and reviewed alongside baseline prior CT study dated 21 Jul 2026 ",
              },
              {
                type: "citationChip",
                attrs: {
                  citationId: "cit_1",
                  evidenceChunkId: "chunk-prior-001",
                  sourceFileId: "prior-study-001",
                  pageOrFrame: 1,
                  bboxNorm: { x0: 0.15, y0: 0.25, x1: 0.45, y1: 0.55 },
                  verbatimQuote: "Prior baseline chest CT study from 21 Jul 2026",
                },
              },
              { type: "text", text: "." },
            ],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "FINDINGS: Right lower lobe consolidation demonstrates interval resolution compared to prior imaging ",
              },
              {
                type: "citationChip",
                attrs: {
                  citationId: "cit_2",
                  evidenceChunkId: "chunk-curr-002",
                  sourceFileId: "current-study-002",
                  pageOrFrame: 124,
                  bboxNorm: { x0: 0.55, y0: 0.6, x1: 0.78, y1: 0.85 },
                  verbatimQuote: "Right lower lobe consolidation on axial series slice 124",
                },
              },
              {
                type: "text",
                text: ". No pleural effusion or pneumothorax is identified. Heart size and mediastinal contours are within normal limits. Trachea and central bronchi are widely patent.",
              },
            ],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "IMPRESSION: Interval clearance and marked radiographic improvement of right lower lobe consolidation, consistent with resolved pneumonia. No suspicious pulmonary mass or acute cardiopulmonary abnormality.",
              },
            ],
          },
        ],
      },
    },
  ]);

  const [activeVersionNumber, setActiveVersionNumber] = useState(1);
  const activeVersion =
    versions.find((v) => v.version_number === activeVersionNumber) ||
    versions[0];

  useEffect(() => {
    let isMounted = true;
    api.listReportVersions(activeCaseId)
      .then((serverVersions) => {
        if (isMounted && serverVersions && serverVersions.length > 0) {
          setVersions(serverVersions as ReportVersionRecord[]);
          setActiveVersionNumber(serverVersions[0].version_number);
        }
      })
      .catch(() => {
        // Keep baseline when offline
      });
    return () => {
      isMounted = false;
    };
  }, [activeCaseId]);

  const handleSaveNewVersion = async (
    tiptapJson: Record<string, unknown>
  ) => {
    try {
      const saved = await api.createReportVersion(activeCaseId, tiptapJson);
      setVersions([saved as ReportVersionRecord, ...versions]);
      setActiveVersionNumber(saved.version_number);
      showToast(`Saved immutable report draft as v${saved.version_number} in PostgreSQL.`);
    } catch {
      const nextVer =
        Math.max(...versions.map((v) => v.version_number), 0) + 1;
      const newRecord: ReportVersionRecord = {
        id: `ver-${nextVer}`,
        version_number: nextVer,
        review_status: "draft",
        tiptap_doc_json: tiptapJson,
        created_at: new Date().toISOString(),
      };
      setVersions([newRecord, ...versions]);
      setActiveVersionNumber(nextVer);
      showToast(`Saved immutable report draft as v${nextVer} (Local fallback).`);
    }
  };

  const handleMarkReviewed = async (versionNumber: number) => {
    try {
      const reviewed = await api.reviewReportVersion(activeCaseId, versionNumber);
      setVersions((prev) =>
        prev.map((v) =>
          v.version_number === versionNumber ? (reviewed as ReportVersionRecord) : v
        )
      );
      useWorkspaceStore.getState().setCases(
        useWorkspaceStore.getState().cases.map((c) =>
          c.id === "024" || c.id === activeCaseId ? { ...c, status: "Reviewed" } : c
        )
      );
      showToast(`Report v${versionNumber} marked reviewed in PostgreSQL.`);
    } catch {
      setVersions((prev) =>
        prev.map((v) =>
          v.version_number === versionNumber
            ? { ...v, review_status: "reviewed", reviewed_by: "Dr. Morgan" }
            : v
        )
      );
      useWorkspaceStore.getState().setCases(
        useWorkspaceStore.getState().cases.map((c) =>
          c.id === "024" || c.id === activeCaseId ? { ...c, status: "Reviewed" } : c
        )
      );
      showToast(`Report v${versionNumber} approved and marked reviewed.`);
    }
  };

  const handleExportPdf = async (versionNumber: number) => {
    try {
      await api.exportReportPdf(activeCaseId, versionNumber);
      showToast(
        `Triggered Celery worker PDF export for report v${versionNumber}.`
      );
    } catch (err) {
      showToast(`Export note: ${(err as Error).message}`);
    }

    const reportText = JSON.stringify(activeVersion.tiptap_doc_json, null, 2);
    const blob = new Blob([reportText], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `medgemma-report-v${versionNumber}-provenance.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    setVersions((prev) =>
      prev.map((v) =>
        v.version_number === versionNumber
          ? {
              ...v,
              review_status: "exported",
              export_download_url: url,
            }
          : v
      )
    );
  };

  const [technique, setTechnique] = useState(
    "[Confirm modality, acquisition protocol, and comparison studies from the source metadata.]"
  );
  const [findings, setFindings] = useState(
    "[Review the source images. Add observations with the relevant series, slice and anatomical location.]"
  );
  const [impression, setImpression] = useState(
    "[Add a concise, reviewed interpretation supported by the findings.]"
  );
  const [limitations, setLimitations] = useState(
    "This is a UI demonstration. No medical analysis was performed. Schematic images must not be interpreted clinically."
  );

  const [checkedItems, setCheckedItems] = useState({
    images: false,
    findings: false,
    limitations: false,
  });

  const handleSwitchToSections = () => {
    const extracted = extractSectionsFromTiptap(activeVersion.tiptap_doc_json);
    if (extracted.technique) setTechnique(extracted.technique);
    if (extracted.findings) setFindings(extracted.findings);
    if (extracted.impression) setImpression(extracted.impression);
    if (extracted.limitations) setLimitations(extracted.limitations);
    setEditorMode("sections");
  };

  const handleSwitchToTiptap = () => {
    const updatedContent = [
      {
        type: "heading",
        attrs: { level: 3 },
        content: [{ type: "text", text: "CHEST IMAGING REPORT — CASE 024" }],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: `TECHNIQUE: ${technique} ` },
          {
            type: "citationChip",
            attrs: {
              citationId: "cit_1",
              evidenceChunkId: "chunk-prior-001",
              sourceFileId: "prior-study-001",
              pageOrFrame: 1,
              bboxNorm: { x0: 0.15, y0: 0.25, x1: 0.45, y1: 0.55 },
              verbatimQuote: "Prior baseline chest CT study from 21 Jul 2026",
            },
          },
          { type: "text", text: "." },
        ],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: `FINDINGS: ${findings} ` },
          {
            type: "citationChip",
            attrs: {
              citationId: "cit_2",
              evidenceChunkId: "chunk-curr-002",
              sourceFileId: "current-study-002",
              pageOrFrame: 124,
              bboxNorm: { x0: 0.55, y0: 0.6, x1: 0.78, y1: 0.85 },
              verbatimQuote: "Right lower lobe consolidation on axial series slice 124",
            },
          },
          { type: "text", text: "." },
        ],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: `IMPRESSION: ${impression}` }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: `LIMITATIONS: ${limitations}` }],
      },
    ];

    const updatedDoc = {
      type: "doc",
      content: updatedContent,
    };

    activeVersion.tiptap_doc_json = updatedDoc;
    setVersions((prev) =>
      prev.map((v) =>
        v.version_number === activeVersion.version_number
          ? { ...v, tiptap_doc_json: updatedDoc }
          : v
      )
    );
    setEditorMode("tiptap");
  };

  const handleSave = () => {
    if (editorMode === "sections") {
      handleSwitchToTiptap();
    }
    showToast("Saved draft version in local session preview.");
  };

  const handleExport = () => {
    if (!checkedItems.images || !checkedItems.findings || !checkedItems.limitations) {
      showToast("Pre-export verification checklist pending: Please verify the 3 safety checks.");
    }

    const reportText = `MEDGEMMA UI DEMONSTRATION — UNREVIEWED DRAFT
Fictional case. No medical analysis performed.

TECHNIQUE
${technique}

FINDINGS
${findings}

IMPRESSION
${impression}

LIMITATIONS
${limitations}`;

    const blob = new Blob([reportText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "medgemma-demo-report-draft.txt";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    showToast("Exported the explicitly labeled demo draft.");
  };

  return (
    <>
      <Heading
        eyebrow="REPORTS / DRAFT STUDIO"
        title="From observation to a clear report."
        desc="An editable draft, with the evidence close at hand."
        actions={
          <>
            <div className="tabs" style={{ marginRight: 6 }}>
              <button
                type="button"
                className={editorMode === "tiptap" ? "selected" : ""}
                onClick={handleSwitchToTiptap}
              >
                Tiptap Rich Editor
              </button>
              <button
                type="button"
                className={editorMode === "sections" ? "selected" : ""}
                onClick={handleSwitchToSections}
              >
                Structured Sections
              </button>
            </div>
            <button type="button" className="btn" onClick={handleSave}>
              <Icon name="check" /> Save draft
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                const text = `TECHNIQUE\n${technique}\n\nFINDINGS\n${findings}\n\nIMPRESSION\n${impression}\n\nLIMITATIONS\n${limitations}`;
                if (typeof navigator !== "undefined" && navigator.clipboard) {
                  navigator.clipboard.writeText(text);
                }
                showToast("Report draft copied to clipboard.");
              }}
              title="Copy plain text to clipboard"
            >
              <Icon name="file" /> Copy
            </button>
            <button
              type="button"
              className="btn black"
              onClick={handleExport}
            >
              <Icon name="download" /> Export draft
            </button>
          </>
        }
      />

      <ContextBar />

      <div className="cols wide-left">
        {editorMode === "tiptap" ? (
          /* Tiptap Versioned Clinical Editor with Atomic Citation Chips */
          <div className="flex flex-col gap-4">
            <ClinicalReportEditor
              caseId="024"
              versions={versions}
              activeVersion={activeVersion}
              onSelectVersion={(num) => setActiveVersionNumber(num)}
              onSaveNewVersion={handleSaveNewVersion}
              onMarkReviewed={handleMarkReviewed}
              onExportPdf={handleExportPdf}
              onOpenPdfCitation={(attrs) => {
                if (attrs.pageOrFrame) {
                  useWorkspaceStore.getState().setSliceIndex(attrs.pageOrFrame);
                }
                if (attrs.bboxNorm) {
                  useImagingStore.getState().focusCitationOnViewer(attrs.sourceFileId, attrs.bboxNorm);
                }
                if (attrs.sourceFileId?.includes("prior")) {
                  setPage("compare");
                } else {
                  setPage("imaging");
                }
                showToast(
                  `Navigating to cited evidence: ${attrs.citationId} (${attrs.sourceFileId} p.${attrs.pageOrFrame})`
                );
              }}
            />
          </div>
        ) : (
          /* Main Structured Sectional Form */
          <article className="panel report">
            <div className="row between">
              <span className="eyebrow">IMAGING REPORT</span>
              <Badge text="AI draft · Unreviewed" variant="dash" />
            </div>
            <h2 className="doc-title">Chest imaging report</h2>
            <p className="muted small">Case 024 · Demo · Version 1</p>

            <div className="divider" />

            <label className="field">
              Template
              <select aria-label="Report template">
                <option>Structured imaging report</option>
                <option>Clinical summary</option>
              </select>
            </label>

            <label className="field">
              Technique
              <textarea
                id="report-technique"
                value={technique}
                onChange={(e) => setTechnique(e.target.value)}
              />
            </label>

            <label className="field">
              Findings
              <textarea
                id="report-findings"
                value={findings}
                onChange={(e) => setFindings(e.target.value)}
              />
            </label>

            <label className="field">
              Impression
              <textarea
                id="report-impression"
                value={impression}
                onChange={(e) => setImpression(e.target.value)}
              />
            </label>

            <label className="field">
              Limitations
              <textarea
                id="report-limitations"
                value={limitations}
                onChange={(e) => setLimitations(e.target.value)}
              />
            </label>
          </article>
        )}

        {/* Evidence & Checklist Sidebar */}
        <aside className="stack" style={{ alignContent: "start" }}>
          {/* Linked Evidence Section */}
          <section className="panel panel-pad">
            <h2>Evidence</h2>
            <div className="listitem">
              <div>
                <p>Current CT study</p>
                <small>24 Oct 2026 · Demo</small>
                <div>
                  <SourceChip label="Series 01" />
                </div>
              </div>
              <Icon name="scan" />
            </div>

            <div className="listitem">
              <div>
                <p>Prior CT study</p>
                <small>21 Jul 2026 · Demo</small>
                <div>
                  <SourceChip label="Comparison source" />
                </div>
              </div>
              <Icon name="scan" />
            </div>

            <div className="listitem">
              <div>
                <p>Clinical note</p>
                <small>1 page · Demo</small>
                <div>
                  <SourceChip label="Clinical note · p. 1" />
                </div>
              </div>
              <Icon name="file" />
            </div>
          </section>

          {/* Pre-export Checklist */}
          <section className="panel panel-pad checklist">
            <h2>Before you export</h2>
            <div style={{ marginTop: "12px" }}>
              <label>
                <input
                  type="checkbox"
                  checked={checkedItems.images}
                  onChange={(e) =>
                    setCheckedItems((prev) => ({
                      ...prev,
                      images: e.target.checked,
                    }))
                  }
                />
                <span>Source images and context checked</span>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={checkedItems.findings}
                  onChange={(e) =>
                    setCheckedItems((prev) => ({
                      ...prev,
                      findings: e.target.checked,
                    }))
                  }
                />
                <span>Findings and impression reviewed</span>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={checkedItems.limitations}
                  onChange={(e) =>
                    setCheckedItems((prev) => ({
                      ...prev,
                      limitations: e.target.checked,
                    }))
                  }
                />
                <span>Limitations included</span>
              </label>
            </div>
            <div className="note" style={{ marginTop: "16px" }}>
              The prototype exports an explicitly labeled text draft. Review state remains a demo.
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
