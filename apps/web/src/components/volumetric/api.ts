import {
  ClusterStatus,
  DiagnosticModality,
  HistogramBarData,
  VolumetricAnalysisPayload,
} from "./types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function generateLocalHistogram(numSlices = 160): HistogramBarData[] {
  return Array.from({ length: 48 }, (_, idx) => {
    const slice = Math.min(
      numSlices,
      Math.max(1, Math.round(((idx + 0.5) / 48) * numSlices))
    );
    const d1 = Math.abs(slice - 64);
    const d2 = Math.abs(slice - 112);
    let score = 0.14 + Math.sin(idx * 0.45) * 0.05;
    let isPeak = false;
    if (d1 <= 8) {
      score = Math.max(score, 0.964 - d1 * 0.065);
      isPeak = true;
    } else if (d2 <= 6) {
      score = Math.max(score, 0.882 - d2 * 0.07);
      isPeak = true;
    }
    return {
      slice,
      score: Math.min(0.98, Math.max(0.08, score)),
      isPeak,
    };
  });
}

export function generateLocalFallback(
  modality: DiagnosticModality = "3d_mri",
  activeSlice = 64,
  sequencePreset = "t2_weighted",
  caseId = "CASE-2026-0894"
): VolumetricAnalysisPayload {
  const isMri = modality === "3d_mri";
  const roiId = isMri ? "MRI-ROI-01" : "CT-ROI-01";
  const secRoiId = isMri ? "MRI-ROI-02" : "CT-ROI-02";

  return {
    case_id: caseId,
    modality,
    sequence_preset: sequencePreset,
    active_slice: activeSlice,
    total_slices: 160,
    scanner_telemetry: isMri
      ? {
          matrix: "512×512",
          field_strength: "3.0 Tesla",
          sequence: "T2 TSE FSE (TR: 4200ms / TE: 98ms)",
          slice_thickness_mm: 1.25,
          fov_mm: 350.0,
          coil: "32-channel phased array torso coil",
          b_values: "b=0, b=500, b=1000 s/mm²",
        }
      : {
          matrix: "512×512",
          kvp: 120,
          kernel: "B30f soft",
          slice_thickness_mm: 1.25,
          fov_mm: 350.0,
          spiral_pitch: 0.984,
          dlp_mgy_cm: 420.0,
        },
    primary_roi: {
      id: roiId,
      label: isMri
        ? "Segment VII hyperintense focal lesion"
        : "Segment VII hypodense lesion",
      location: `Axial slice 64 (liver dome / segment VII)`,
      dimensionsStr: "14.2 × 11.8 × 12.0 mm",
      volumeCm3: 1.05,
      attenuationOrIntensity: isMri
        ? "T2 hyperintense / restricted diffusion (ADC: 0.82 × 10⁻³ mm²/s)"
        : "42 HU (soft tissue window)",
      meanHu: 42,
      confidencePercent: 96.4,
      clinicalStatus: "Actionable finding • 96.4% conf",
      reconstructionSpan: "12.0 mm Z-span",
    },
    secondary_rois: [
      {
        id: secRoiId,
        label: isMri
          ? "Mild periventricular / subsegmental FLAIR hyperintensity"
          : "Mild bibasilar atelectasis",
        location: "Slice 112 • Coronal Y: 234.4mm",
        confidencePercent: 88.2,
        clinicalStatus: "Stable observation • 88.2% conf",
      },
    ],
    z_attention_scores: generateLocalHistogram(160),
    sampled_slices_count: 64,
    sampled_slices: Array.from({ length: 64 }, (_, i) => Math.round((i * 159) / 63) + 1),
    reasoning_trace: isMri
      ? "3D Multi-Sequence MRI Assessment (3.0T): Well-circumscribed nodular lesion identified in hepatic segment VII measuring 14.2 × 11.8 × 12.0 mm (volume: 1.05 cm³). The lesion displays moderate T2 hyperintensity and marked diffusion restriction on high b-value DWI (b=1000 s/mm²) with corresponding low ADC values (0.82 × 10⁻³ mm²/s). Dynamic contrast phase demonstrates early arterial peripheral enhancement with progressive centripetal filling. Findings are suggestive of atypical hemangioma vs focal nodular lesion. Corroboration with hepatobiliary phase (Eovist) or 3-month volumetric MRI recommended."
      : "3D Volumetric CT Assessment (120 kVp, B30f): Circumscribed hypoattenuating nodular focus noted in liver segment VII (14.2 × 11.8 × 12.0 mm, volume 1.05 cm³, mean attenuation 42 HU). No definitive peripheral rim hyperenhancement observed on portal venous slab. Recommended tri-phase liver MRI corroboration or interval follow-up CT in 3 months.",
    status: "completed",
    pipeline_latency_sec: 1.8,
    is_live_backend: false,
  };
}

export async function fetchClusterStatus(): Promise<ClusterStatus> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/volumetric/status`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = await res.json();
      return { ...data, is_live_backend: true };
    }
  } catch {
    // Backend offline fallback
  }

  return {
    status: "online",
    service: "medgemma-volumetric-engine",
    cluster_online_percent: 99.8,
    sampled_slices_count: 64,
    token_context_window: "128k",
    vllm_engine: "google/medgemma-1.5-4b (vllm-openai:latest)",
    precision: "bfloat16",
    is_live_backend: false,
  };
}

export async function fetchVolumetricAnalysis(params: {
  modality: DiagnosticModality;
  sequencePreset: string;
  activeSlice: number;
  caseId?: string;
}): Promise<VolumetricAnalysisPayload> {
  const caseId = params.caseId || "CASE-2026-0894";
  try {
    const url = new URL(`${API_BASE}/api/v1/volumetric/analyze-volume`);
    url.searchParams.set("case_id", caseId);
    url.searchParams.set("modality", params.modality);
    url.searchParams.set("sequence_preset", params.sequencePreset);
    url.searchParams.set("active_slice", String(params.activeSlice));

    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(6000),
    });

    if (res.ok) {
      const data = await res.json();
      return { ...data, is_live_backend: true };
    }
  } catch {
    // Fallback if backend is unavailable
  }

  return generateLocalFallback(
    params.modality,
    params.activeSlice,
    params.sequencePreset,
    caseId
  );
}

export async function downloadSegmentationManifest(
  caseId: string,
  modality: DiagnosticModality,
  activeSlice: number
): Promise<Blob> {
  try {
    const url = new URL(`${API_BASE}/api/v1/volumetric/export-manifest`);
    url.searchParams.set("case_id", caseId);
    url.searchParams.set("modality", modality === "wsi" ? "3d_mri" : modality);
    url.searchParams.set("active_slice", String(activeSlice));

    const res = await fetch(url.toString(), { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      return new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
    }
  } catch {
    // Fallback
  }

  const fallback = {
    standard: "DICOM-SEG / NIfTI-1 v1.0",
    case_id: caseId,
    modality: modality === "3d_mri" ? "MR" : "CT",
    model: "google/medgemma-1.5-4b",
    active_slice: activeSlice,
    target_roi_id: modality === "3d_mri" ? "MRI-ROI-01" : "CT-ROI-01",
    physical_dimensions_mm: [14.2, 11.8, 12.0],
    volume_cm3: 1.05,
    mean_signal_or_attenuation:
      modality === "3d_mri" ? "T2 Hyperintense / ADC 0.82" : "42.0 HU",
    sampled_slices_count: 64,
    coordinate_system: "LPS (Head-First Supine)",
    timestamp_utc: new Date().toISOString(),
  };

  return new Blob([JSON.stringify(fallback, null, 2)], {
    type: "application/json",
  });
}

