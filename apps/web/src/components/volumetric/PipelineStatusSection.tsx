"use client";

import React from "react";

export function PipelineStatusSection() {
  return (
    <section className="reveal-on-scroll wellness-card-lg bg-white/90 border border-[#E8EFE8] p-8 sm:p-10 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-expressive text-3xl text-[#78716C]">
            Harmonizing python medical precision with human-centered calm
          </p>
          <h2 className="wellness-section-heading font-semibold text-[#292524] mt-1">
            End-to-end python &amp; docker pipeline status.
          </h2>
        </div>
        <span className="px-4 py-2 rounded-full bg-[#EFEDF4] text-xs font-semibold text-[#292524]">
          FastAPI + SimpleITK + MONAI + MedGemma 1.5
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-5 pt-2">
        <div className="rounded-[2rem] bg-[#FDFCF8] p-5 border border-[#292524]/5 space-y-2">
          <span className="px-3 py-1 rounded-full bg-[#E8EFE8] text-xs font-semibold text-[#292524]">
            1. Ingestion
          </span>
          <h3 className="text-base font-semibold text-[#292524] pt-1">
            SimpleITK &amp; pydicom
          </h3>
          <p className="text-xs text-[#78716C] leading-relaxed">
            Reconstructs 160 2d dicom slices into a calibrated 3d tensor with 1.25mm slice spacing.
          </p>
        </div>

        <div className="rounded-[2rem] bg-[#FDFCF8] p-5 border border-[#292524]/5 space-y-2">
          <span className="px-3 py-1 rounded-full bg-[#EFEDF4] text-xs font-semibold text-[#292524]">
            2. Quantification
          </span>
          <h3 className="text-base font-semibold text-[#292524] pt-1">
            MONAI 3d &amp; NumPy
          </h3>
          <p className="text-xs text-[#78716C] leading-relaxed">
            Computes deterministic 3d lesion spans (14.2×11.8×12.0mm), true volume (1.05 cm³), and mean signal/attenuation.
          </p>
        </div>

        <div className="rounded-[2rem] bg-[#FDFCF8] p-5 border border-[#292524]/5 space-y-2">
          <span className="px-3 py-1 rounded-full bg-[#FFB7B2]/60 text-xs font-semibold text-[#292524]">
            3. Attention gate
          </span>
          <h3 className="text-base font-semibold text-[#292524] pt-1">
            40% sparse z-sampler
          </h3>
          <p className="text-xs text-[#78716C] leading-relaxed">
            Prioritizes high-confidence anomaly peaks (slice 64 &amp; slice 112) alongside uniform anatomical context strides.
          </p>
        </div>

        <div className="rounded-[2rem] bg-[#FDFCF8] p-5 border border-[#292524]/5 space-y-2">
          <span className="px-3 py-1 rounded-full bg-[#E8EFE8] text-xs font-semibold text-[#292524]">
            4. VLM container
          </span>
          <h3 className="text-base font-semibold text-[#292524] pt-1">
            Dockerized vLLM engine
          </h3>
          <p className="text-xs text-[#78716C] leading-relaxed">
            Streams MedGemma 1.5 clinical reasoning traces over SSE within a 128k multimodal token context window.
          </p>
        </div>
      </div>
    </section>
  );
}

