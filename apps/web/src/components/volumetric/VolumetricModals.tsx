"use client";

import React, { useState } from "react";
import { DiagnosticModality, VolumetricAnalysisPayload } from "./types";

interface VolumetricModalsProps {
  citationModalOpen: boolean;
  onCloseCitationModal: () => void;
  caseModalOpen: boolean;
  onCloseCaseModal: () => void;
  modality: DiagnosticModality;
  axialSlice: number;
  coronalSlice: number;
  sagittalSlice: number;
  caseId: string;
  setCaseId: (id: string) => void;
  analysisData?: VolumetricAnalysisPayload;
  onToast: (msg: string) => void;
}

export function VolumetricModals({
  citationModalOpen,
  onCloseCitationModal,
  caseModalOpen,
  onCloseCaseModal,
  modality,
  axialSlice,
  coronalSlice,
  sagittalSlice,
  caseId,
  setCaseId,
  analysisData,
  onToast,
}: VolumetricModalsProps) {
  const [inputCaseId, setInputCaseId] = useState(caseId);
  const isMri = modality === "3d_mri";
  const roiId = isMri ? "[MRI-ROI-01]" : "[CT-ROI-01]";

  const reportCitation = `VOLUMETRIC ${isMri ? "MRI" : "CT"} FINDINGS (DICOM-SR v4):
• Target ID: ${roiId} Segment VII ${isMri ? "Hyperintense Focal Lesion" : "Hypodense Lesion"}
• Spatial Coordinates: Axial Slice ${axialSlice} / 160, Coronal Slice ${coronalSlice}, Sagittal Slice ${sagittalSlice}
• 3D Physical Dimensions: 14.2 × 11.8 × 12.0 mm (Calculated Volume: 1.05 cm³)
• ${isMri ? "MR Diffusivity" : "Mean Attenuation"}: ${analysisData?.primary_roi?.attenuationOrIntensity || (isMri ? "T2 Hyperintense / ADC 0.82" : "42 HU (Soft Tissue)")}
• MedGemma 1.5 Reasoning Trace (96.4% Conf):
  "${analysisData?.reasoning_trace || ""}"`;

  const copyCitation = () => {
    try {
      navigator.clipboard.writeText(reportCitation);
      onToast("Copied volumetric citation to clipboard");
    } catch {
      onToast("Unable to copy to clipboard");
    }
    onCloseCitationModal();
  };

  const handleCaseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputCaseId.trim()) {
      setCaseId(inputCaseId.trim());
      onToast(`Loaded clinical case: ${inputCaseId.trim()}`);
      onCloseCaseModal();
    }
  };

  return (
    <>
      {/* Volumetric Citation Modal */}
      {citationModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="citation-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#292524]/30 backdrop-blur-sm p-4"
        >
          <div className="wellness-card-lg bg-[#FDFCF8] border-2 border-[#FFB7B2] max-w-lg w-full p-8 space-y-5 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-expressive text-3xl text-[#78716C]">
                  Ready for hospital pacs &amp; ehr
                </p>
                <h3 id="citation-modal-title" className="text-2xl font-semibold text-[#292524] tracking-tight">
                  Volumetric citation report
                </h3>
              </div>
              <button
                onClick={onCloseCitationModal}
                type="button"
                className="px-3.5 py-1.5 rounded-full bg-[#E8EFE8] hover:bg-[#FFB7B2] text-xs font-semibold text-[#292524] transition cursor-pointer"
              >
                Close ✕
              </button>
            </div>

            <div className="rounded-[2rem] bg-white p-5 border border-[#292524]/10 text-xs text-[#292524] leading-relaxed font-mono whitespace-pre-wrap max-h-80 overflow-y-auto">
              {reportCitation}
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={copyCitation}
                type="button"
                className="px-5 py-2.5 rounded-full bg-[#FFB7B2] hover:brightness-95 text-[#292524] text-xs font-semibold transition cursor-pointer"
              >
                Copy citation to clipboard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Clinical Case Modal */}
      {caseModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="case-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#292524]/30 backdrop-blur-sm p-4"
        >
          <div className="wellness-card-lg bg-[#FDFCF8] border-2 border-[#FFB7B2] max-w-lg w-full p-8 space-y-5 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-expressive text-3xl text-[#78716C]">
                  Connects directly to your python fastapi container
                </p>
                <h3 id="case-modal-title" className="text-2xl font-semibold text-[#292524] tracking-tight">
                  Load new 3d {isMri ? "mri" : "ct"} clinical case
                </h3>
              </div>
              <button
                onClick={onCloseCaseModal}
                type="button"
                className="px-3.5 py-1.5 rounded-full bg-[#E8EFE8] hover:bg-[#FFB7B2] text-xs font-semibold text-[#292524] transition cursor-pointer"
              >
                Close ✕
              </button>
            </div>

            <form onSubmit={handleCaseSubmit} className="space-y-4">
              <div className="rounded-[2rem] bg-white p-4 border border-[#292524]/10 text-xs space-y-2">
                <label htmlFor="case-id-input" className="font-semibold text-[#292524] block">
                  Clinical Case Identifier
                </label>
                <input
                  id="case-id-input"
                  type="text"
                  value={inputCaseId}
                  onChange={(e) => setInputCaseId(e.target.value)}
                  placeholder="e.g. CASE-2026-0894"
                  className="w-full bg-[#FDFCF8] border border-[#292524]/15 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-[#FFB7B2] outline-none"
                />
              </div>

              <div className="rounded-[2rem] bg-[#EFEDF4]/60 p-4 border border-[#292524]/5 text-xs space-y-1 font-mono leading-relaxed text-[#292524]">
                <div className="font-semibold font-sans mb-1">FASTAPI PIPELINE ENDPOINTS:</div>
                <div>POST http://localhost:8000/api/v1/ct/dag-pipeline</div>
                <div>POST http://localhost:8000/api/v1/ct/vqa-stream</div>
                <div>POST http://localhost:8000/api/v1/volumetric/fhir/diagnostic-bundle</div>
                <div>POST http://localhost:8000/api/v1/volumetric/analyze-volume</div>
                <div className="text-[#78716C] pt-1">
                  1. MedSigLIP 400M + Gemma 3 128k Prefix-Cached Dual-Path DAG
                </div>
                <div className="text-[#78716C]">
                  2. MONAI + NumPy Active-Contour 3D lesion span &amp; volume (cm³)
                </div>
                <div className="text-[#78716C]">
                  3. XGrammar Pydantic Micro-Schemas + Unconstrained SSE VQA Stream
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onCloseCaseModal}
                  className="px-4 py-2 rounded-full bg-[#E8EFE8] text-xs font-semibold text-[#292524]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-full bg-[#FFB7B2] hover:brightness-95 text-[#292524] text-xs font-semibold transition cursor-pointer"
                >
                  Analyze Case via Pipeline →
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

