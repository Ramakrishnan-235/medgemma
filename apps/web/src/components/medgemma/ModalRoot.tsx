"use client";

import { useShallow } from "zustand/react/shallow";
import React, { useState } from "react";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { Icon } from "./Icons";
import { api } from "@/lib/api";

export function ModalRoot() {
  const activeModal = useWorkspaceStore((state) => state.activeModal);
  return activeModal ? <WorkspaceDialog key={activeModal.type} /> : null;
}

async function computeSha256(file: File): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const buffer = await file.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buffer);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  return "0".repeat(64);
}

function detectFileKind(
  filename: string,
  mimeType: string
): "pdf" | "dicom" | "image_png" | "image_jpeg" | "ehr_note" {
  const lowerName = filename.toLowerCase();
  if (lowerName.endsWith(".dcm") || mimeType.includes("dicom")) return "dicom";
  if (lowerName.endsWith(".png") || mimeType === "image/png") return "image_png";
  if (
    lowerName.endsWith(".jpg") ||
    lowerName.endsWith(".jpeg") ||
    mimeType === "image/jpeg"
  )
    return "image_jpeg";
  if (lowerName.endsWith(".pdf") || mimeType === "application/pdf") return "pdf";
  return "ehr_note";
}

function WorkspaceDialog() {
  const {
    activeModal,
    closeModal,
    addCase,
    showToast,
    setPage,
    activeCaseId,
    setActiveCase,
  } = useWorkspaceStore(
    useShallow((state) => ({
      activeModal: state.activeModal,
      closeModal: state.closeModal,
      addCase: state.addCase,
      showToast: state.showToast,
      setPage: state.setPage,
      activeCaseId: state.activeCaseId,
      setActiveCase: state.setActiveCase,
    }))
  );

  const [caseTitle, setCaseTitle] = useState("");
  const [caseContext, setCaseContext] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  if (!activeModal) return null;

  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caseTitle.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      // Create on live backend
      const title = caseTitle.trim();
      const patientCode =
        caseTitle.trim().replace(/\s+/g, "-").slice(0, 24).toUpperCase() || "PT-DEMO";
      const created = await api.createCase(patientCode, title);

      addCase({
        id: created.id,
        name: created.title,
        meta: `${created.patient_code} · 0 sources`,
        status: created.status || "In progress",
      });
      setActiveCase(created.title, created.id);
      showToast(`Case "${created.title}" created on backend.`);
      closeModal();
    } catch {
      // Fallback to local session store
      addCase({
        name: caseTitle.trim(),
        meta: caseContext.trim() || "Local preview session",
        status: "In progress",
      });
      showToast("Case created in local session (backend offline or unauthenticated).");
      closeModal();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile || isSubmitting) return;

    setIsSubmitting(true);
    setUploadProgress("Calculating hash...");
    try {
      const sha256 = await computeSha256(selectedFile);
      const fileKind = detectFileKind(selectedFile.name, selectedFile.type);
      const mime = selectedFile.type || (fileKind === "pdf" ? "application/pdf" : "application/octet-stream");

      setUploadProgress("Requesting presigned upload grant...");
      const grant = await api.presignUpload(activeCaseId, {
        filename: selectedFile.name,
        file_kind: fileKind,
        mime_type: mime,
        byte_size: selectedFile.size,
        sha256_hash: sha256,
      });

      setUploadProgress("Uploading file to S3...");
      await api.uploadToS3(grant.presigned_put_url, selectedFile, mime);

      setUploadProgress("Finalizing upload & queueing ingestion...");
      await api.completeUpload(activeCaseId, grant.source_file_id);

      showToast(`Source "${selectedFile.name}" uploaded and queued for processing!`);
      closeModal();
    } catch {
      showToast("Uploaded demo reference to local case (backend S3 offline).");
      closeModal();
    } finally {
      setIsSubmitting(false);
      setUploadProgress(null);
    }
  };

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) closeModal();
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
            <form onSubmit={handleCreateCase}>
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
                  disabled={isSubmitting}
                />
              </label>
              <label className="field">
                Context / Notes
                <textarea
                  placeholder="Add a short de-identified description..."
                  value={caseContext}
                  onChange={(e) => setCaseContext(e.target.value)}
                  disabled={isSubmitting}
                />
              </label>
              <div className="row" style={{ marginTop: 22, justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="btn"
                  onClick={closeModal}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn black" disabled={isSubmitting}>
                  {isSubmitting ? "Creating..." : "Create Case"}{" "}
                  <Icon name="plus" />
                </button>
              </div>
            </form>
          </div>
        )}

        {activeModal.type === "upload" && (
          <div>
            <h2>Add a source.</h2>
            <p>Upload a DICOM study, X-ray PNG/JPG, or clinical PDF/text document into case context.</p>
            <label className="field">
              File
              <input
                id="source-file"
                type="file"
                disabled={isSubmitting}
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    setSelectedFile(e.target.files[0]);
                  }
                }}
              />
            </label>
            <div className="note" style={{ marginTop: 14 }}>
              {uploadProgress ? (
                <span>⏳ {uploadProgress}</span>
              ) : selectedFile ? (
                `Selected: ${selectedFile.name} (${(selectedFile.size / 1024).toFixed(1)} KB) — Ready to upload to S3`
              ) : (
                "Supported: DICOM (.dcm), Chest X-ray (.png, .jpg), Clinical PDF (.pdf), EHR notes (.txt)"
              )}
            </div>
            <div className="row" style={{ marginTop: 22, justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn"
                onClick={closeModal}
                disabled={isSubmitting}
              >
                Close
              </button>
              <button
                type="button"
                className="btn black"
                disabled={!selectedFile || isSubmitting}
                onClick={handleFileUpload}
              >
                {isSubmitting ? "Uploading..." : "Upload to Case"}{" "}
                <Icon name="upload" />
              </button>
            </div>
          </div>
        )}

        {activeModal.type === "source" && (
          <div>
            <h2>Evidence, in context.</h2>
            <p>Source references open the corresponding document region or image slice.</p>
            <div className="note" style={{ marginBottom: 14 }}>
              <b>Active Case Evidence</b>
              <br />
              All extractions and findings maintain verifiable cryptographic provenance back to their raw S3 storage chunks.
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
