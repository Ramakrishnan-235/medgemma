"use client";

import React, { useEffect } from "react";
import { VolumetricHeader } from "@/components/volumetric/VolumetricHeader";
import { VolumetricHero } from "@/components/volumetric/VolumetricHero";
import { MprGrid } from "@/components/volumetric/MprGrid";
import { ZAxisAttentionCard } from "@/components/volumetric/ZAxisAttentionCard";
import { VolumetricSidebar } from "@/components/volumetric/VolumetricSidebar";
import { PipelineStatusSection } from "@/components/volumetric/PipelineStatusSection";
import { VolumetricModals } from "@/components/volumetric/VolumetricModals";
import { VolumetricToast } from "@/components/volumetric/VolumetricToast";
import { useVolumetricState } from "@/components/volumetric/use-volumetric-state";

export default function VolumetricWorkspacePage() {
  const state = useVolumetricState();

  // Scroll reveal observer
  useEffect(() => {
    const elements = document.querySelectorAll(".reveal-on-scroll");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
          }
        });
      },
      { threshold: 0.08 }
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const handleReplayReveal = () => {
    const els = document.querySelectorAll(".reveal-on-scroll");
    els.forEach((el) => el.classList.remove("is-visible"));
    setTimeout(() => {
      els.forEach((el) => el.classList.add("is-visible"));
    }, 120);
    state.showToast("Replayed reveal-on-scroll transitions");
  };

  return (
    <div className="min-h-screen relative selection:bg-[#FFB7B2]/40 selection:text-[#292524]">
      {/* 0.35 Opacity Fractal Noise Grain Overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-50"
        style={{ opacity: 0.35 }}
        aria-hidden="true"
      >
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <filter id="digital-wellness-grain">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.78"
              numOctaves="3"
              stitchTiles="stitch"
            />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect
            width="100%"
            height="100%"
            filter="url(#digital-wellness-grain)"
            opacity="0.28"
          />
        </svg>
      </div>

      {/* Ambient Floating Blobs */}
      <div
        className="fixed inset-0 pointer-events-none overflow-hidden z-0"
        aria-hidden="true"
      >
        <div className="floating-blob absolute -top-20 -left-20 w-[28rem] h-[28rem] rounded-full bg-[#E8EFE8]/80 blur-3xl" />
        <div className="floating-blob-delayed absolute top-1/4 -right-24 w-[32rem] h-[32rem] rounded-full bg-[#EFEDF4]/90 blur-3xl" />
        <div className="floating-blob-slow absolute -bottom-24 left-1/3 w-[26rem] h-[26rem] rounded-full bg-[#FFB7B2]/35 blur-3xl" />
      </div>

      {/* Main Content Container */}
      <div className="relative z-10 max-w-[1440px] mx-auto px-4 sm:px-8 py-6 sm:py-10 space-y-8">
        <VolumetricHeader
          clusterStatus={state.clusterStatus}
          onNewCase={() => state.setCaseModalOpen(true)}
          onReplayReveal={handleReplayReveal}
        />

        <VolumetricHero
          modality={state.modality}
          setModality={state.setModality}
          wlPreset={state.wlPreset}
          setWlPreset={state.setWlPreset}
          currentSlabMode={state.currentSlabMode}
          cycleSlabMode={state.cycleSlabMode}
          syncLocked={state.syncLocked}
          setSyncLocked={state.setSyncLocked}
          onToast={state.showToast}
        />

        {/* 4-Pane MPR + Volumetric Findings Grid */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-8 space-y-6">
            <MprGrid
              modality={state.modality}
              wlPreset={state.wlPreset}
              axialSlice={state.axialSlice}
              coronalSlice={state.coronalSlice}
              sagittalSlice={state.sagittalSlice}
              syncLocked={state.syncLocked}
              crosshairX={state.crosshairX}
              crosshairY={state.crosshairY}
              setCrosshair={(x, y) => {
                state.setCrosshairX(x);
                state.setCrosshairY(y);
              }}
              setSlicePosition={state.setSlicePosition}
              currentHuOrSignal={state.currentHuOrSignal}
              currentSlabMode={state.currentSlabMode}
              azimuth={state.azimuth}
              setAzimuth={state.setAzimuth}
              elevation={state.elevation}
              setElevation={state.setElevation}
              autoOrbit={state.autoOrbit}
              setAutoOrbit={state.setAutoOrbit}
              onToast={state.showToast}
            />

            <ZAxisAttentionCard
              axialSlice={state.axialSlice}
              onSliceChange={state.setSlicePosition}
              histogramBars={state.histogramBars}
              activeAttentionText={state.activeAttentionText}
            />
          </div>

          <VolumetricSidebar
            modality={state.modality}
            analysisData={state.analysisData}
            streamedReasoning={state.streamedReasoning}
            onReStream={state.reStreamReasoning}
            onJumpRoi1={state.jumpToRoi1}
            onJumpRoi2={state.jumpToRoi2}
            onExportNifti={state.handleExportNifti}
            onOpenCitationModal={() => state.setCitationModalOpen(true)}
          />
        </section>

        <PipelineStatusSection />
      </div>

      <VolumetricModals
        citationModalOpen={state.citationModalOpen}
        onCloseCitationModal={() => state.setCitationModalOpen(false)}
        caseModalOpen={state.caseModalOpen}
        onCloseCaseModal={() => state.setCaseModalOpen(false)}
        modality={state.modality}
        axialSlice={state.axialSlice}
        coronalSlice={state.coronalSlice}
        sagittalSlice={state.sagittalSlice}
        caseId={state.caseId}
        setCaseId={state.setCaseId}
        analysisData={state.analysisData}
        onToast={state.showToast}
      />

      <VolumetricToast message={state.toastMessage} />
    </div>
  );
}
