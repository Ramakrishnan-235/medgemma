"use client";

import React from "react";
import { AxialViewport } from "./AxialViewport";
import { CoronalViewport } from "./CoronalViewport";
import { SagittalViewport } from "./SagittalViewport";
import { ThreeDSlabViewport } from "./ThreeDSlabViewport";
import { DiagnosticModality, SlabMode, WindowPreset } from "./types";

interface MprGridProps {
  modality: DiagnosticModality;
  wlPreset: WindowPreset;
  axialSlice: number;
  coronalSlice: number;
  sagittalSlice: number;
  syncLocked: boolean;
  crosshairX: number;
  crosshairY: number;
  setCrosshair: (x: number, y: number) => void;
  setSlicePosition: (s: number) => void;
  currentHuOrSignal: string;
  currentSlabMode: SlabMode;
  azimuth: number;
  setAzimuth: React.Dispatch<React.SetStateAction<number>>;
  elevation: number;
  setElevation: React.Dispatch<React.SetStateAction<number>>;
  autoOrbit: boolean;
  setAutoOrbit: React.Dispatch<React.SetStateAction<boolean>>;
  onToast: (msg: string) => void;
}

export function MprGrid({
  modality,
  wlPreset,
  axialSlice,
  coronalSlice,
  sagittalSlice,
  syncLocked,
  crosshairX,
  crosshairY,
  setCrosshair,
  setSlicePosition,
  currentHuOrSignal,
  currentSlabMode,
  azimuth,
  setAzimuth,
  elevation,
  setElevation,
  autoOrbit,
  setAutoOrbit,
  onToast,
}: MprGridProps) {
  return (
    <div className="reveal-on-scroll grid grid-cols-1 md:grid-cols-2 gap-6">
      <AxialViewport
        slice={axialSlice}
        modality={modality}
        wlPreset={wlPreset}
        crosshairX={crosshairX}
        crosshairY={crosshairY}
        onCrosshairChange={setCrosshair}
        currentHuOrSignal={currentHuOrSignal}
      />

      <CoronalViewport
        slice={coronalSlice}
        axialSlice={axialSlice}
        modality={modality}
        wlPreset={wlPreset}
        crosshairX={crosshairX}
        syncLocked={syncLocked}
        onSliceClick={setSlicePosition}
      />

      <SagittalViewport
        slice={sagittalSlice}
        axialSlice={axialSlice}
        modality={modality}
        wlPreset={wlPreset}
        crosshairY={crosshairY}
        onSliceClick={setSlicePosition}
      />

      <ThreeDSlabViewport
        axialSlice={axialSlice}
        modality={modality}
        currentSlabMode={currentSlabMode}
        azimuth={azimuth}
        setAzimuth={setAzimuth}
        elevation={elevation}
        setElevation={setElevation}
        autoOrbit={autoOrbit}
        setAutoOrbit={setAutoOrbit}
        onToast={onToast}
      />
    </div>
  );
}

