"use client";

import React, { useState } from "react";
import { fetchSliceVQA } from "./api";
import { DiagnosticModality, TargetedSliceVQAResponse, VolumetricAnalysisPayload } from "./types";

interface VolumetricSidebarProps {
  modality: DiagnosticModality;
  analysisData?: VolumetricAnalysisPayload;
  streamedReasoning: string;
  onReStream: () => void;
  onJumpRoi1: () => void;
  onJumpRoi2: () => void;
  onExportNifti: () => void;
  onOpenCitationModal: () => void;
}

export function VolumetricSidebar({
  modality,
  analysisData,
  streamedReasoning,
  onReStream,
  onJumpRoi1,
  onJumpRoi2,
  onExportNifti,
  onOpenCitationModal,
}: VolumetricSidebarProps) {
  const [accordionOpen, setAccordionOpen] = useState(false);
  const [vqaQuestion, setVqaQuestion] = useState("");
  const [vqaLoading, setVqaLoading] = useState(false);
  const [vqaResponse, setVqaResponse] = useState<TargetedSliceVQAResponse | null>(null);

  const isMri = modality === "3d_mri";
  const primaryRoi = analysisData?.primary_roi;
  const secondaryRoi = analysisData?.secondary_rois?.[0];
  const telemetry = analysisData?.scanner_telemetry;
  const activeSlice = analysisData?.active_slice || 64;

  const handleAskVqa = async (customQ?: string) => {
    const q = customQ || vqaQuestion;
    if (!q.trim()) return;
    setVqaLoading(true);
    try {
      const resp = await fetchSliceVQA({
        case_id: analysisData?.case_id || "CASE-2026-0894",
        slice_index: activeSlice,
        tissue_window: (analysisData?.sequence_preset as any) || "soft_tissue",
        question: q,
      });
      setVqaResponse(resp);
    } finally {
      setVqaLoading(false);
    }
  };

  return (
    <aside className="lg:col-span-4 space-y-6">
      {/* Top Telemetry Summary Cards */}
      <div className="reveal-on-scroll grid grid-cols-2 gap-4">
        <div className="wellness-card bg-[#E8EFE8] p-6 space-y-2 border border-white">
          <span className="text-xs font-medium text-[#78716C]">Detected 3d rois</span>
          <div className="flex items-baseline justify-between pt-1">
            <span className="text-4xl font-bold text-[#292524] tracking-tight">3</span>
            <span className="px-3 py-1 rounded-full bg-[#FFB7B2] text-[#292524] text-[11px] font-semibold">
              1 actionable
            </span>
          </div>
          <p className="font-expressive text-xl text-[#78716C]">2 stable observations</p>
        </div>

        <div className="wellness-card bg-[#EFEDF4] p-6 space-y-2 border border-white">
          <span className="text-xs font-medium text-[#78716C]">Volume inference</span>
          <div className="flex items-baseline justify-between pt-1">
            <span className="text-4xl font-bold text-[#292524] tracking-tight">1.8s</span>
            <span className="px-3 py-1 rounded-full bg-white text-[#292524] text-[11px] font-semibold">
              128k tokens
            </span>
          </div>
          <p className="font-expressive text-xl text-[#78716C]">vLLM bfloat16 engine</p>
        </div>
      </div>

      {/* Volumetric Findings Main Card */}
      <div className="reveal-on-scroll wellness-card-lg bg-white/95 border border-[#EFEDF4] p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-[#292524] tracking-tight">
              Volumetric findings
            </h2>
            <p className="font-expressive text-2xl text-[#78716C]">
              Structured dicom-sr v4 telemetry
            </p>
          </div>
          <span className="px-3.5 py-1 rounded-full bg-[#FDFCF8] border border-[#292524]/10 text-xs font-semibold text-[#78716C]">
            DICOM-SR v4
          </span>
        </div>

        {/* Primary Actionable ROI Card */}
        <div className="rounded-[2rem] bg-[#FDFCF8] border-2 border-[#FFB7B2] p-5 space-y-4 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="inline-block px-3 py-0.5 rounded-full bg-[#FFB7B2] text-[#292524] text-xs font-semibold">
                [{primaryRoi?.id || (isMri ? "MRI-ROI-01" : "CT-ROI-01")}] • Actionable
              </span>
              <h3 className="text-base font-semibold text-[#292524] mt-2">
                {primaryRoi?.label || "Segment VII lesion"}
              </h3>
              <p className="text-xs text-[#78716C]">
                {primaryRoi?.location || "Location: Axial slice 64 (liver dome)"}
              </p>
            </div>
            <span className="text-xs font-semibold text-[#292524] bg-[#FFB7B2]/30 px-2.5 py-1 rounded-full whitespace-nowrap">
              {primaryRoi?.confidencePercent || 96.4}% conf
            </span>
          </div>

          {/* Deterministic Quantification Table */}
          <div className="rounded-[1.5rem] bg-white p-4 space-y-2.5 text-xs border border-[#292524]/5">
            <div className="flex justify-between items-center">
              <span className="text-[#78716C]">3d dimensions:</span>
              <span className="font-semibold text-[#292524]">
                {primaryRoi?.dimensionsStr || "14.2 × 11.8 × 12.0 mm"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#78716C]">Calculated volume:</span>
              <span className="font-semibold text-[#292524]">
                {primaryRoi?.volumeCm3 || 1.05} cm³
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#78716C]">
                {isMri ? "MR Diffusivity:" : "Mean attenuation:"}
              </span>
              <span className="font-semibold text-[#292524]">
                {primaryRoi?.attenuationOrIntensity || (isMri ? "T2 hyperintense" : "42 HU")}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#78716C]">Clinical status:</span>
              <span className="font-semibold text-[#292524] bg-[#FFB7B2]/50 px-2.5 py-0.5 rounded-full">
                {primaryRoi?.clinicalStatus || "Actionable finding • 96.4% conf"}
              </span>
            </div>
          </div>

          {/* AI Reasoning Trace with Stream Control */}
          <div className="rounded-[1.5rem] bg-[#EFEDF4]/60 p-4 space-y-2 border border-[#292524]/5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#292524] flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-[#FFB7B2] animate-ping" />
                <span>MedGemma 1.5 reasoning trace</span>
              </span>
              <button
                onClick={onReStream}
                type="button"
                className="text-[11px] font-medium text-[#78716C] hover:text-[#292524] underline cursor-pointer"
              >
                Re-stream trace
              </button>
            </div>
            <p className="text-xs text-[#292524] leading-relaxed min-h-[4.5rem]">
              {streamedReasoning}
            </p>
          </div>

          {/* Jump & Recenter Button */}
          <button
            onClick={onJumpRoi1}
            type="button"
            className="w-full py-3 px-4 rounded-full bg-[#FFB7B2] hover:brightness-95 text-[#292524] font-semibold text-xs transition shadow-sm flex items-center justify-center space-x-2 cursor-pointer"
          >
            <span>Jump to slice 64 &amp; recenter viewports →</span>
          </button>
        </div>

        {/* Interactive Slice VQA Section */}
        <div className="rounded-[2rem] bg-[#FDFCF8] border border-[#292524]/10 p-5 space-y-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#88CCF1] animate-pulse" />
              <h3 className="text-sm font-semibold text-[#292524]">
                Targeted Slice VQA
              </h3>
            </div>
            <span className="text-[11px] font-semibold text-[#78716C] bg-[#EFEDF4] px-2.5 py-0.5 rounded-full">
              Slice {activeSlice} Q&amp;A
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {[
              "Describe lesion on slice 64",
              "Is there a fracture on this slice?",
              "Check right upper lobe parenchyma",
            ].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setVqaQuestion(preset);
                  handleAskVqa(preset);
                }}
                className="text-[10px] font-medium text-[#78716C] hover:text-[#292524] bg-white border border-[#292524]/10 px-2 py-1 rounded-full transition"
              >
                {preset}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={vqaQuestion}
              onChange={(e) => setVqaQuestion(e.target.value)}
              placeholder={`Ask MedGemma about slice ${activeSlice}...`}
              className="flex-1 text-xs px-3.5 py-2 rounded-full border border-[#292524]/15 bg-white text-[#292524] placeholder:text-[#78716C]/60 focus:outline-none focus:border-[#292524]"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAskVqa();
              }}
            />
            <button
              type="button"
              disabled={vqaLoading || !vqaQuestion.trim()}
              onClick={() => handleAskVqa()}
              className="px-4 py-2 rounded-full bg-[#292524] text-white text-xs font-semibold hover:bg-[#3f3f46] disabled:opacity-50 transition cursor-pointer"
            >
              {vqaLoading ? "..." : "Ask"}
            </button>
          </div>

          {vqaResponse && (
            <div className="rounded-[1.25rem] bg-[#EFEDF4]/70 p-3.5 space-y-2 border border-[#292524]/5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-[#292524]">AI Response:</span>
                <span className="font-bold text-[#292524] bg-white px-2 py-0.5 rounded-full">
                  {Math.round(vqaResponse.confidence_score * 100)}% conf
                </span>
              </div>
              <p className="text-xs text-[#292524] leading-relaxed whitespace-pre-line">
                {vqaResponse.answer_markdown}
              </p>
              {vqaResponse.relevant_anatomical_regions && vqaResponse.relevant_anatomical_regions.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {vqaResponse.relevant_anatomical_regions.map((reg) => (
                    <span
                      key={reg}
                      className="text-[9px] font-semibold text-[#78716C] bg-white px-2 py-0.5 rounded-full"
                    >
                      {reg}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Secondary ROI Card */}
        <div className="rounded-[2rem] bg-[#E8EFE8]/60 border border-[#292524]/5 p-5 space-y-3 transition">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-[#78716C]">
                [{secondaryRoi?.id || (isMri ? "MRI-ROI-02" : "CT-ROI-02")}]
              </span>
              <h3 className="text-sm font-semibold text-[#292524]">
                {secondaryRoi?.label || "Secondary observation"}
              </h3>
              <p className="text-xs text-[#78716C]">
                {secondaryRoi?.location || "Slice 112"} • {secondaryRoi?.confidencePercent || 88.2}% confidence
              </p>
            </div>
            <button
              onClick={onJumpRoi2}
              type="button"
              className="px-3.5 py-1.5 rounded-full bg-white hover:bg-[#FFB7B2]/50 text-xs font-semibold text-[#292524] transition shadow-sm cursor-pointer"
            >
              Jump to slice 112
            </button>
          </div>
        </div>

        {/* Reconstruction Kernel / Sequence Telemetry Accordion */}
        <div className="rounded-[2rem] bg-[#FDFCF8] border border-[#292524]/5 p-4 text-xs space-y-1.5">
          <button
            type="button"
            onClick={() => setAccordionOpen((prev) => !prev)}
            className="w-full flex items-center justify-between font-semibold text-[#292524] cursor-pointer"
          >
            <span>{isMri ? "MRI sequence acquisition specs" : "Reconstruction kernel telemetry"}</span>
            <span className="text-[#78716C] font-normal">
              {isMri ? "3.0T Siemens Vida" : (telemetry?.kernel || "B30f soft")} {accordionOpen ? "▲" : "▼"}
            </span>
          </button>
          <p className="text-[#78716C] leading-relaxed">
            {isMri
              ? "32-Ch Body Matrix • 3.0T Isotropic • TR 4200ms / TE 98ms • Bandwidth: 240 Hz/Px • GRAPPA 2"
              : "Sharp B30f • Spiral pitch 0.984 • DLP 420 mGy·cm • IsotropicSimpleITK calibrated"}
          </p>
          {accordionOpen && (
            <div className="pt-2 text-[11px] text-[#78716C] border-t border-[#292524]/5 space-y-1">
              <div>Voxel Dimensions: 0.68 × 0.68 × 1.25 mm</div>
              <div>Slice Count: 160 Slices (128k Multi-modal Token Budget)</div>
              <div>Calibration: SimpleITK &amp; MONAI 3D Isotropic Resampler</div>
            </div>
          )}
        </div>

        {/* Export & Citation Action Buttons */}
        <div className="space-y-3 pt-2">
          <button
            onClick={onExportNifti}
            type="button"
            className="w-full py-3.5 px-5 rounded-full bg-[#E8EFE8] hover:bg-[#FFB7B2]/40 text-[#292524] font-semibold text-xs transition flex items-center justify-center space-x-2 cursor-pointer"
          >
            <span>↓ Export 3d NIfTI / DICOM-SEG</span>
          </button>

          <button
            onClick={onOpenCitationModal}
            type="button"
            className="w-full py-3.5 px-5 rounded-full bg-[#292524] hover:bg-[#292524]/90 text-[#FDFCF8] font-semibold text-xs transition flex items-center justify-center space-x-2 shadow-sm cursor-pointer"
          >
            <span>Insert volumetric citations to report →</span>
          </button>
        </div>
      </div>
    </aside>
  );
}

