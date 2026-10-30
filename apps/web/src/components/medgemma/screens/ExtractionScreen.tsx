"use client";

import { useShallow } from "zustand/react/shallow";
import React, { useState } from "react";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { Heading, Badge } from "../CommonUI";
import { Icon } from "../Icons";

export function ExtractionScreen() {
  const {
    extractionField,
    setExtractionField,
    extractedFields,
    updateExtractedField,
    openModal,
    showToast,
    activeCase,
  } = useWorkspaceStore(
    useShallow((state) => ({
      extractionField: state.extractionField,
      setExtractionField: state.setExtractionField,
      extractedFields: state.extractedFields,
      updateExtractedField: state.updateExtractedField,
      openModal: state.openModal,
      showToast: state.showToast,
      activeCase: state.activeCase,
    }))
  );

  const [verifiedChecked, setVerifiedChecked] = useState(false);

  const handleExport = () => {
    const data = {
      demo: true,
      case_context: activeCase,
      review_status: verifiedChecked ? "reviewed" : "unreviewed",
      source: "fictional-lab-report",
      fields: Object.fromEntries(
        extractedFields.map((f) => [f.id, f.value])
      ),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "medgemma-demo-extracted-fields.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    showToast("Exported the demo fields with review status.");
  };

  return (
    <>
      <Heading
        eyebrow="DOCUMENTS / EXTRACTION"
        title="From page to structured data."
        desc="Inspect every field in the context of its source."
        actions={
          <>
            <button
              type="button"
              className="btn"
              onClick={() => openModal("upload")}
            >
              <Icon name="upload" /> Upload document
            </button>
            <button
              type="button"
              className="btn black"
              onClick={handleExport}
            >
              <Icon name="download" /> Export fields
            </button>
          </>
        }
      />

      {/* Context Bar */}
      <div className="context">
        <div>
          <p>
            <b>Lab report.pdf</b> <Badge text="Demo source" variant="soft" />
          </p>
          <small>1 page · 4 fields extracted · Review pending</small>
        </div>
        <span className="small muted">{activeCase || "Case 024"}</span>
      </div>

      <div className="cols equal">
        {/* Left Column: Visual Source Document Paper with Highlights & Reticle Locators */}
        <section className="panel">
          <div className="panel-head">
            <h2>Source document</h2>
            <span className="muted">Page 1 / 1</span>
          </div>
          <div className="document">
            <div className="paper">
              <p className="eyebrow font-sans m-0">
                DEMONSTRATION LABORATORY
              </p>
              <h3 className="mt-5 text-[20px] font-semibold">
                Laboratory report
              </h3>
              <p>Fictional source · Interface sample</p>

              <div className="divider" />

              <div className="docline">Case ID &nbsp; DEMO-024</div>
              <div className="docline">
                Collected &nbsp;{" "}
                <mark
                  data-field-mark="date"
                  role="button"
                  tabIndex={0}
                  className={`cursor-pointer transition-colors duration-150 inline-flex items-center gap-1 ${
                    extractionField === "date" ? "highlight ring-1 ring-zinc-300" : ""
                  }`}
                  onClick={() => setExtractionField("date")}
                  onKeyDown={(e) => e.key === "Enter" && setExtractionField("date")}
                  title="Click to select Collection date"
                >
                  {extractionField === "date" && <span className="text-[9px] opacity-75 font-mono">⌖</span>}
                  22 Oct 2026
                </mark>
              </div>
              <div className="docline">
                Specimen &nbsp;{" "}
                <mark
                  data-field-mark="specimen"
                  role="button"
                  tabIndex={0}
                  className={`cursor-pointer transition-colors duration-150 inline-flex items-center gap-1 ${
                    extractionField === "specimen" ? "highlight ring-1 ring-zinc-300" : ""
                  }`}
                  onClick={() => setExtractionField("specimen")}
                  onKeyDown={(e) => e.key === "Enter" && setExtractionField("specimen")}
                  title="Click to select Specimen"
                >
                  {extractionField === "specimen" && <span className="text-[9px] opacity-75 font-mono">⌖</span>}
                  Whole blood
                </mark>
              </div>

              <div className="divider" />

              <div className="docline">
                Hemoglobin &nbsp;{" "}
                <mark
                  data-field-mark="hemoglobin"
                  role="button"
                  tabIndex={0}
                  className={`cursor-pointer transition-colors duration-150 inline-flex items-center gap-1 ${
                    extractionField === "hemoglobin" ? "highlight ring-1 ring-zinc-300" : ""
                  }`}
                  onClick={() => setExtractionField("hemoglobin")}
                  onKeyDown={(e) => e.key === "Enter" && setExtractionField("hemoglobin")}
                  title="Click to select Hemoglobin"
                >
                  {extractionField === "hemoglobin" && <span className="text-[9px] opacity-75 font-mono">⌖</span>}
                  13.2 g/dL
                </mark>
              </div>
              <div className="docline">
                White blood cells &nbsp;{" "}
                <mark
                  data-field-mark="wbc"
                  role="button"
                  tabIndex={0}
                  className={`cursor-pointer transition-colors duration-150 inline-flex items-center gap-1 ${
                    extractionField === "wbc" ? "highlight ring-1 ring-zinc-300" : ""
                  }`}
                  onClick={() => setExtractionField("wbc")}
                  onKeyDown={(e) => e.key === "Enter" && setExtractionField("wbc")}
                  title="Click to select White blood cells"
                >
                  {extractionField === "wbc" && <span className="text-[9px] opacity-75 font-mono">⌖</span>}
                  6.4 ×10⁹/L
                </mark>
              </div>

              <p className="text-zinc-500 text-[11px] leading-relaxed mt-11">
                Illustrative values only.
                <br />
                No real patient information.
              </p>
            </div>
          </div>
        </section>

        {/* Right Column: Editable Fields linked to Document Marks */}
        <section className="panel panel-pad">
          <div className="row between">
            <h2>Extracted fields</h2>
            <Badge text="4 fields" variant="soft" />
          </div>
          <p className="muted small my-2.5 mb-3.5">
            Select a source link to locate the original value.
          </p>

          {extractedFields.map((f) => (
            <div key={f.id} className="fieldrow">
              <label htmlFor={`field-${f.id}`}>{f.label}</label>
              <input
                id={`field-${f.id}`}
                value={f.value}
                data-field-id={f.id}
                onChange={(e) => updateExtractedField(f.id, e.target.value)}
              />
              <button
                type="button"
                className={`btn tiny ${
                  extractionField === f.id ? "black" : ""
                }`}
                onClick={() => setExtractionField(f.id)}
                aria-label={`Locate ${f.label} in source`}
              >
                p. 1 ↗
              </button>
            </div>
          ))}

          <div className="divider" />

          <div className="checklist">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={verifiedChecked}
                onChange={(e) => setVerifiedChecked(e.target.checked)}
              />
              <span>I have checked the fields against the source.</span>
            </label>
          </div>

          <div className="row mt-5">
            <button
              type="button"
              className="btn black"
              onClick={() =>
                showToast("Saved in this design preview. No backend is connected.")
              }
            >
              <Icon name="check" /> Save corrections
            </button>
          </div>

          <div className="note mt-6">
            Extraction outputs remain editable. A field should retain its source
            location and review status after correction.
          </div>
        </section>
      </div>
    </>
  );
}
