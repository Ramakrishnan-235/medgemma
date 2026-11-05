"use client";

import React from "react";
import { RadStudioHeader } from "@/components/radstudio/RadStudioHeader";
import { RadStudioDock } from "@/components/radstudio/RadStudioDock";
import { MprSeriesSidebar } from "@/components/radstudio/MprSeriesSidebar";
import { CtViewport } from "@/components/radstudio/CtViewport";
import { DiagnosticAssessmentPanel } from "@/components/radstudio/DiagnosticAssessmentPanel";
import { DiagnosticReportPanel } from "@/components/radstudio/DiagnosticReportPanel";
import { FhirModal } from "@/components/radstudio/FhirModal";
import { VolumetricModal3D } from "@/components/radstudio/VolumetricModal3D";
import { DicomUploadModal } from "@/components/radstudio/DicomUploadModal";
import { RadStudioToast } from "@/components/radstudio/RadStudioToast";
import { useRadStudioState } from "@/components/radstudio/use-radstudio-state";

export default function MedGemmaRadStudioPage() {
  const state = useRadStudioState();

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-[#F3F4F6] text-gray-900 select-none">
      {/* Top Workstation Header */}
      <RadStudioHeader
        modality={state.modality}
        setModality={state.setModality}
        onOpenUploadModal={() => state.setUploadModalOpen(true)}
        onToast={state.showToast}
        hasStudy={state.hasStudy}
        activeDataset={state.activeDataset}
      />

      {/* Main 4-Column Workstation Layout */}
      <main className="flex-1 flex overflow-hidden">
        {/* Column 0: Leftmost Icon Dock */}
        <RadStudioDock onToast={state.showToast} />

        {/* Column 1: MPR & Series Sidebar */}
        <MprSeriesSidebar
          currentSeries={state.series}
          onSelectSeries={state.setSeries}
          onOpenUploadModal={() => state.setUploadModalOpen(true)}
          onToast={state.showToast}
          hasStudy={state.hasStudy}
          activeDataset={state.activeDataset}
        />

        {/* Column 2: Central Medical CT Viewport */}
        <CtViewport
          activeDataset={state.activeDataset}
          hasStudy={state.hasStudy}
          onOpenUploadModal={() => state.setUploadModalOpen(true)}
          onDicomUploadSuccess={state.handleDicomUploaded}
          series={state.series}
          slice={state.slice}
          totalSlices={state.totalSlices}
          zPositionMm={state.zPositionMm}
          setSlice={state.setSlice}
          isPlaying={state.isPlaying}
          setIsPlaying={state.setIsPlaying}
          wlPreset={state.wlPreset}
          setWlPreset={state.setWlPreset}
          activeTool={state.activeTool}
          setActiveTool={state.setActiveTool}
          zoomPercent={state.zoomPercent}
          setZoomPercent={state.setZoomPercent}
          isInverted={state.isInverted}
          setIsInverted={state.setIsInverted}
          highlightedBox={state.highlightedBox}
          setHighlightedBox={state.setHighlightedBox}
          splitSync={state.splitSync}
          setSplitSync={state.setSplitSync}
          heatmapEnabled={state.heatmapEnabled}
          setHeatmapEnabled={state.setHeatmapEnabled}
          onOpen3dView={() => state.setVolumetric3dOpen(true)}
          onToast={state.showToast}
          reconSpecs={state.reconSpecs}
          box01={state.box01}
          box02={state.box02}
          isInferring={state.isInferring}
          inferenceStage={state.inferenceStage}
        />

        {/* Column 3: Right Diagnostic Assessment & Structured Report Panel */}
        <section
          aria-label="Diagnostic Intelligence Panel"
          className="w-[410px] shrink-0 flex flex-col gap-3 p-3 overflow-y-auto bg-[#F8FAFC] border-l border-gray-200"
        >
          {/* Diagnostic Assessment Card */}
          <DiagnosticAssessmentPanel
            data={state.assessment}
            onOpenFhirModal={() => state.setFhirModalOpen(true)}
            onSyncEhr={state.triggerEhrSync}
            ehrSyncStatus={state.ehrSyncStatus}
            onToast={state.showToast}
            hasStudy={state.hasStudy}
            onOpenUploadModal={() => state.setUploadModalOpen(true)}
          />

          {/* Diagnostic Report Card */}
          <DiagnosticReportPanel
            expandedSections={state.expandedSections}
            onToggleSection={state.toggleSection}
            onJumpBox01={state.jumpToBox01}
            onJumpBox02={state.jumpToBox02}
            currentSlice={state.slice}
            hasStudy={state.hasStudy}
            report={state.report}
            box01={state.box01}
            box02={state.box02}
          />
        </section>
      </main>

      {/* HL7 FHIR R4 Modal */}
      <FhirModal
        isOpen={state.fhirModalOpen}
        onClose={() => state.setFhirModalOpen(false)}
        assessment={state.assessment}
        box01={state.box01}
        onToast={state.showToast}
      />

      {/* 3D Volumetric View Modal */}
      <VolumetricModal3D
        isOpen={state.volumetric3dOpen}
        onClose={() => state.setVolumetric3dOpen(false)}
        box01={state.box01}
        onToast={state.showToast}
      />

      {/* DICOM Upload & Ingestion Modal */}
      <DicomUploadModal
        isOpen={state.uploadModalOpen}
        onClose={() => state.setUploadModalOpen(false)}
        onUploadSuccess={state.handleDicomUploaded}
        onToast={state.showToast}
      />

      {/* Global Workstation Toast */}
      <RadStudioToast message={state.toastMessage} />
    </div>
  );
}
