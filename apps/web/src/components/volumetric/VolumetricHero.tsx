"use client";

import React from "react";
import { DiagnosticModality, SlabMode, WindowPreset } from "./types";

interface VolumetricHeroProps {
  modality: DiagnosticModality;
  setModality: (m: DiagnosticModality) => void;
  wlPreset: WindowPreset;
  setWlPreset: (p: WindowPreset) => void;
  currentSlabMode: SlabMode;
  cycleSlabMode: () => void;
  syncLocked: boolean;
  setSyncLocked: (s: boolean) => void;
  onToast: (msg: string) => void;
}

export function VolumetricHero({
  modality,
  setModality,
  wlPreset,
  setWlPreset,
  currentSlabMode,
  cycleSlabMode,
  syncLocked,
  setSyncLocked,
  onToast,
}: VolumetricHeroProps) {
  const isMri = modality === "3d_mri";

  const handleModalityChange = (m: DiagnosticModality, label: string) => {
    setModality(m);
    if (m === "3d_mri") {
      setWlPreset("t2_weighted");
    } else {
      setWlPreset("soft_tissue");
    }
    onToast(`Switched workspace view to ${label}`);
  };

  return (
    <section className="reveal-on-scroll wellness-card-lg bg-gradient-to-br from-[#E8EFE8]/75 via-[#FDFCF8] to-[#EFEDF4]/80 border border-white p-8 sm:p-12 relative overflow-hidden">
      <div className="max-w-4xl space-y-4 relative z-10">
        <p className="font-expressive text-3xl sm:text-4xl text-[#292524]/90">
          Mindful volumetric clarity • 64 slices gently sampled
        </p>
        <h1 className="wellness-hero-heading font-semibold text-[#292524]">
          {isMri
            ? "Calm volumetric clarity for 3d mri diagnostics."
            : "Calm volumetric clarity for 3d ct diagnostics."}
        </h1>
        <p className="text-base sm:text-lg text-[#78716C] max-w-2xl leading-relaxed font-normal">
          Explore multi-planar reconstructions, deterministic {isMri ? "MR sequence diffusivity" : "Hounsfield unit"} telemetry, and sparse z-axis attention in a serene workspace designed to reduce radiologist cognitive fatigue.
        </p>

        {/* Modality Switcher & Windowing Controls */}
        <div className="pt-4 flex flex-wrap items-center justify-between gap-4">
          {/* Modality Tabs */}
          <div className="inline-flex flex-wrap items-center bg-white/80 p-1.5 rounded-[2rem] border border-[#292524]/5 shadow-sm gap-1">
            <button
              type="button"
              onClick={() => handleModalityChange("3d_mri", "3d mri multi-sequence")}
              className={`px-5 py-2.5 rounded-[1.75rem] text-xs transition cursor-pointer ${
                modality === "3d_mri"
                  ? "bg-[#FFB7B2] font-semibold text-[#292524]"
                  : "font-medium text-[#78716C] hover:text-[#292524]"
              }`}
            >
              3d mri multi-sequence
            </button>
            <button
              type="button"
              onClick={() => handleModalityChange("3d_ct", "3d ct volume")}
              className={`px-5 py-2.5 rounded-[1.75rem] text-xs transition cursor-pointer ${
                modality === "3d_ct"
                  ? "bg-[#FFB7B2] font-semibold text-[#292524]"
                  : "font-medium text-[#78716C] hover:text-[#292524]"
              }`}
            >
              3d ct volume
            </button>
            <button
              type="button"
              onClick={() => handleModalityChange("wsi", "wsi histopathology")}
              className={`px-5 py-2.5 rounded-[1.75rem] text-xs transition cursor-pointer ${
                modality === "wsi"
                  ? "bg-[#FFB7B2] font-semibold text-[#292524]"
                  : "font-medium text-[#78716C] hover:text-[#292524]"
              }`}
            >
              Wsi histopathology
            </button>
          </div>

          {/* Window/Level & Slab Presets */}
          <div className="flex flex-wrap items-center gap-2.5">
            <label htmlFor="wl-preset-select" className="text-xs font-medium text-[#78716C]">
              {isMri ? "Sequence preset:" : "Window preset:"}
            </label>
            <select
              id="wl-preset-select"
              value={wlPreset}
              onChange={(e) => {
                const nextPreset = e.target.value as WindowPreset;
                setWlPreset(nextPreset);
                onToast(`Applied preset: ${e.target.options[e.target.selectedIndex].text}`);
              }}
              className="bg-white/90 border border-[#292524]/10 rounded-full px-4 py-2 text-xs font-medium text-[#292524] focus:outline-none focus:ring-2 focus:ring-[#FFB7B2] cursor-pointer"
            >
              {isMri ? (
                <>
                  <option value="t2_weighted">T2 TSE High-Res (TR 4200 / TE 98 ms)</option>
                  <option value="t1_weighted">T1 Spin-Echo Axial (TR 650 / TE 14 ms)</option>
                  <option value="flair">FLAIR Suppression (TI 2200 ms)</option>
                  <option value="dwi_adc">DWI / ADC Diffusivity (b=1000 s/mm²)</option>
                  <option value="t1_contrast">T1 + Gadolinium Contrast</option>
                </>
              ) : (
                <>
                  <option value="soft_tissue">W/l soft tissue (40 / 400 hu)</option>
                  <option value="liver_dome">Liver dome contrast (60 / 160 hu)</option>
                  <option value="lung">Lung parenchyma (-600 / 1500 hu)</option>
                  <option value="bone">Bone structure (300 / 1500 hu)</option>
                </>
              )}
            </select>

            <button
              onClick={cycleSlabMode}
              type="button"
              className="px-4 py-2 rounded-full bg-white/90 hover:bg-[#FFB7B2]/40 border border-[#292524]/10 text-xs font-semibold text-[#292524] transition cursor-pointer"
            >
              Slab mode: <span>{currentSlabMode}</span>
            </button>

            <button
              onClick={() => {
                const next = !syncLocked;
                setSyncLocked(next);
                onToast(`Orthogonal viewport crosshair ${next ? "locked" : "unlocked"}`);
              }}
              type="button"
              className="px-4 py-2 rounded-full bg-[#E8EFE8] border border-[#292524]/10 text-xs font-semibold text-[#292524] transition flex items-center space-x-1.5 cursor-pointer"
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  syncLocked ? "bg-[#292524]" : "bg-amber-500"
                }`}
              />
              <span>{syncLocked ? "Sync: locked" : "Sync: unlocked"}</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

