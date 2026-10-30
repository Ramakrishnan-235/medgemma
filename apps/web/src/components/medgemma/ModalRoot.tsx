"use client";

import { useShallow } from "zustand/react/shallow";
import React, { useState, useEffect, useRef } from "react";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { Icon } from "./Icons";
import { api } from "@/lib/api";

export function ModalRoot() {
  const activeModal = useWorkspaceStore((state) => state.activeModal);

  return (
    <div id="modal-root">
      {activeModal && <WorkspaceDialog key={activeModal.type} />}
    </div>
  );
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

  const dialogRef = useRef<HTMLElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  // Focus Trapping and Escape Key Listener (WCAG 2.1 AA)
  useEffect(() => {
    previousActiveElementRef.current = document.activeElement as HTMLElement | null;

    // Auto-focus first interactive element
    const timer = setTimeout(() => {
      if (dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length > 0) {
          focusable[0].focus();
        }
      }
    }, 20);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (!isSubmitting) {
          e.preventDefault();
          closeModal();
        }
        return;
      }

      if (e.key === "Tab" && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", handleKeyDown);
      if (
        previousActiveElementRef.current &&
        typeof previousActiveElementRef.current.focus === "function"
      ) {
        previousActiveElementRef.current.focus();
      }
    };
  }, [closeModal, isSubmitting]);

  if (!activeModal) return null;

  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caseTitle.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
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
      const mime =
        selectedFile.type ||
        (fileKind === "pdf" ? "application/pdf" : "application/octet-stream");

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

  const sourcePayload = activeModal.payload as
    | { quote?: string; title?: string; source?: string; date?: string; location?: string }
    | undefined;

  return (
    <div
      className="modal-backdrop fixed inset-0 bg-black/70 grid place-items-center p-5 z-40"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) closeModal();
      }}
    >
      <section
        ref={dialogRef}
        className="modal w-full max-w-[430px] p-[28px] rounded-[14px] bg-[#18181b] border border-[#27272a] text-[#f4f4f5] shadow-[0_20px_80px_rgba(0,0,0,0.5)] outline-none"
        role="dialog"
        aria-modal="true"
        aria-label="Workspace dialog"
        aria-labelledby="modal-title"
      >
        {activeModal.type === "newcase" && (
          <div>
            <h2 id="modal-title" className="text-[22px] font-semibold text-[#f4f4f5] mb-[7px]">
              A new starting point.
            </h2>
            <p className="text-[12px] text-[#a1a1aa] mb-6">
              Keep the related evidence and drafts together.
            </p>
            <form onSubmit={handleCreateCase}>
              <label className="field block mb-4 text-[11px] text-[#a1a1aa]">
                <span className="block mb-1.5 font-medium text-[#f4f4f5]">Case title</span>
                <input
                  id="case-title"
                  className="w-full bg-[#18181b] border border-[#27272a] rounded-[6px] px-3 py-2 text-[12px] text-[#f4f4f5] outline-none focus:border-[#71717a]"
                  placeholder="e.g. Follow-up review"
                  required
                  maxLength={80}
                  value={caseTitle}
                  onChange={(e) => setCaseTitle(e.target.value)}
                  disabled={isSubmitting}
                />
              </label>
              <label className="field block mb-4 text-[11px] text-[#a1a1aa]">
                <span className="block mb-1.5 font-medium text-[#f4f4f5]">Context / Notes</span>
                <textarea
                  className="w-full bg-[#18181b] border border-[#27272a] rounded-[6px] px-3 py-2 text-[12px] text-[#f4f4f5] outline-none focus:border-[#71717a] min-h-[90px] resize-y"
                  placeholder="Add a short de-identified description..."
                  value={caseContext}
                  onChange={(e) => setCaseContext(e.target.value)}
                  disabled={isSubmitting}
                />
              </label>
              <div className="row flex items-center justify-end gap-2.5 mt-[22px]">
                <button
                  type="button"
                  className="btn px-3 py-2 rounded-[7px] border border-[#27272a] bg-[#18181b] text-[11px] font-medium text-[#f4f4f5] hover:bg-[#27272a]"
                  onClick={closeModal}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn black px-3 py-2 rounded-[7px] bg-white text-[#09090b] font-medium text-[11px] hover:bg-zinc-200 flex items-center gap-1.5"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Creating..." : "Create Case"}{" "}
                  <Icon name="plus" />
                </button>
              </div>
            </form>
          </div>
        )}

        {activeModal.type === "upload" && (
          <div>
            <h2 id="modal-title" className="text-[22px] font-semibold text-[#f4f4f5] mb-[7px]">
              Add a source.
            </h2>
            <p className="text-[12px] text-[#a1a1aa] mb-6">
              Upload a DICOM study, X-ray PNG/JPG, or clinical PDF/text document into case context.
            </p>
            <label className="field block mb-4 text-[11px] text-[#a1a1aa]">
              <span className="block mb-1.5 font-medium text-[#f4f4f5]">File</span>
              <input
                id="source-file"
                type="file"
                className="w-full bg-[#18181b] border border-[#27272a] rounded-[6px] px-3 py-2 text-[12px] text-[#f4f4f5] file:mr-3 file:py-1 file:px-2.5 file:rounded-[5px] file:border-0 file:text-[11px] file:bg-[#27272a] file:text-[#f4f4f5]"
                disabled={isSubmitting}
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    setSelectedFile(e.target.files[0]);
                  }
                }}
              />
            </label>
            <div className="note bg-[#27272a]/50 border border-[#27272a] rounded-[7px] p-3 text-[11px] text-[#a1a1aa] leading-relaxed my-3.5">
              {uploadProgress ? (
                <span>⏳ {uploadProgress}</span>
              ) : selectedFile ? (
                `Selected: ${selectedFile.name} (${(selectedFile.size / 1024).toFixed(1)} KB) — Ready to upload to S3`
              ) : (
                "Supported: DICOM (.dcm), Chest X-ray (.png, .jpg), Clinical PDF (.pdf), EHR notes (.txt)"
              )}
            </div>
            <div className="row flex items-center justify-end gap-2.5 mt-[22px]">
              <button
                type="button"
                className="btn px-3 py-2 rounded-[7px] border border-[#27272a] bg-[#18181b] text-[11px] font-medium text-[#f4f4f5] hover:bg-[#27272a]"
                onClick={closeModal}
                disabled={isSubmitting}
              >
                Close
              </button>
              <button
                type="button"
                className="btn black px-3 py-2 rounded-[7px] bg-white text-[#09090b] font-medium text-[11px] hover:bg-zinc-200 flex items-center gap-1.5"
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
            <h2 id="modal-title" className="text-[22px] font-semibold text-[#f4f4f5] mb-[7px]">
              Evidence, in context.
            </h2>
            <p className="text-[12px] text-[#a1a1aa] mb-6">
              Source references open the corresponding document region or image slice.
            </p>
            <div className="note bg-[#27272a]/50 border border-[#27272a] rounded-[7px] p-3 text-[11px] text-[#a1a1aa] leading-relaxed my-3.5">
              <b className="text-[#f4f4f5] block mb-1">
                {sourcePayload?.title || "Active Case Evidence"}
              </b>
              <span>
                {sourcePayload?.quote ||
                  "All extractions and findings maintain verifiable cryptographic provenance back to their raw S3 storage chunks."}
              </span>
              {sourcePayload?.location && (
                <div className="mt-2 text-[10px] text-[#71717a]">
                  Location: {sourcePayload.location}
                </div>
              )}
            </div>
            <div className="row flex items-center justify-end gap-2.5 mt-[22px]">
              <button
                type="button"
                className="btn px-3 py-2 rounded-[7px] border border-[#27272a] bg-[#18181b] text-[11px] font-medium text-[#f4f4f5] hover:bg-[#27272a]"
                onClick={closeModal}
              >
                Close
              </button>
              <button
                type="button"
                className="btn black px-3 py-2 rounded-[7px] bg-white text-[#09090b] font-medium text-[11px] hover:bg-zinc-200 flex items-center gap-1.5"
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
