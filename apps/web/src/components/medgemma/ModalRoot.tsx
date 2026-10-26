"use client";

import React, { useState } from "react";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { Icon } from "./Icons";

export function ModalRoot() {
  const { activeModal, closeModal, addCase, showToast, setPage } =
    useWorkspaceStore();

  const [caseTitle, setCaseTitle] = useState("");
  const [caseContext, setCaseContext] = useState("");
  const [selectedFileName, setSelectedFileName] = useState("");

  if (!activeModal) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeModal();
      }}
    >
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Workspace dialog"
      >
        {activeModal.type === "newcase" && (
          <div>
            <h2>A new starting point.</h2>
            <p>Keep the related evidence and drafts together.</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!caseTitle.trim()) return;
                addCase({
                  name: caseTitle.trim(),
                  meta: caseContext.trim() || "No sources yet",
                  status: "In progress",
                });
                closeModal();
                showToast("Demo case created for this preview session.");
              }}
            >
              <label className="field">
                Case title
                <input
                  id="case-title"
                  placeholder="e.g. Follow-up review"
                  required
                  maxLength={80}
                  value={caseTitle}
                  onChange={(e) => setCaseTitle(e.target.value)}
                  autoFocus
                />
              </label>
              <label className="field">
                Context
                <textarea
                  placeholder="Add a short de-identified description..."
                  value={caseContext}
                  onChange={(e) => setCaseContext(e.target.value)}
                />
              </label>
              <div className="row" style={{ marginTop: 22, justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="btn"
                  onClick={closeModal}
                >
                  Cancel
                </button>
                <button type="submit" className="btn black">
                  Create demo case <Icon name="plus" />
                </button>
              </div>
            </form>
          </div>
        )}

        {activeModal.type === "upload" && (
          <div>
            <h2>Add a source.</h2>
            <p>Choose a local file to preview the upload state. It will not be uploaded or processed.</p>
            <label className="field">
              File
              <input
                id="demo-file"
                type="file"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    setSelectedFileName(e.target.files[0].name);
                  }
                }}
              />
            </label>
            <div className="note" style={{ marginTop: 14 }}>
              {selectedFileName
                ? `Selected: ${selectedFileName} — Ready for demo preview`
                : "Supported file types and limits depend on the implemented pipeline."}
            </div>
            <div className="row" style={{ marginTop: 22, justifyContent: "flex-end" }}>
              <button type="button" className="btn" onClick={closeModal}>
                Close
              </button>
              <button
                type="button"
                className="btn black"
                onClick={() => {
                  if (selectedFileName) {
                    closeModal();
                    showToast("Demo source selected. No file was uploaded or analyzed.");
                  } else {
                    showToast("Choose a file to preview the selected-file state.");
                  }
                }}
              >
                Add to demo case <Icon name="plus" />
              </button>
            </div>
          </div>
        )}

        {activeModal.type === "source" && (
          <div>
            <h2>Evidence, in context.</h2>
            <p>Source references open the corresponding document region or image slice.</p>
            <div className="note" style={{ marginBottom: 14 }}>
              <b>Demo source</b>
              <br />
              Case 024 · Fictional source material
              <br />
              <br />
              The implemented panel should show the exact excerpt, source ID, date and location used by the output.
            </div>
            <div className="row" style={{ marginTop: 22, justifyContent: "flex-end" }}>
              <button type="button" className="btn" onClick={closeModal}>
                Close
              </button>
              <button
                type="button"
                className="btn black"
                onClick={() => {
                  closeModal();
                  setPage("case");
                }}
              >
                Open case sources <Icon name="arrow" />
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
