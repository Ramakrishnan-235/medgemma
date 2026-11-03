import { describe, expect, it } from "bun:test";
import { generateLocalFallback, generateLocalHistogram } from "./api";

describe("Volumetric API & Simulation Logic", () => {
  it("generates 48-bin attention histogram with normalized bounds", () => {
    const bins = generateLocalHistogram(160);
    expect(bins).toHaveLength(48);

    for (const bin of bins) {
      expect(bin.slice).toBeGreaterThanOrEqual(1);
      expect(bin.slice).toBeLessThanOrEqual(160);
      expect(bin.score).toBeGreaterThanOrEqual(0.08);
      expect(bin.score).toBeLessThanOrEqual(0.98);
    }

    const peakBins = bins.filter((b) => b.isPeak);
    expect(peakBins.length).toBeGreaterThan(0);

    // Peak at slice 64
    const peak64 = bins.find((b) => Math.abs(b.slice - 64) <= 2);
    expect(peak64?.isPeak).toBe(true);
    expect(peak64?.score).toBeGreaterThan(0.8);
  });

  it("generates correct MRI volumetric telemetry payload", () => {
    const payload = generateLocalFallback("3d_mri", 64, "t2_weighted", "CASE-TEST-001");
    expect(payload.modality).toBe("3d_mri");
    expect(payload.case_id).toBe("CASE-TEST-001");
    expect(payload.active_slice).toBe(64);
    expect(payload.primary_roi.id).toBe("MRI-ROI-01");
    expect(payload.primary_roi.confidencePercent).toBe(96.4);
    expect(payload.primary_roi.volumeCm3).toBe(1.05);
    expect(payload.scanner_telemetry.field_strength).toBe("3.0 Tesla");
    expect(payload.sampled_slices_count).toBe(64);
    expect(payload.sampled_slices).toHaveLength(64);
  });

  it("generates correct CT volumetric telemetry payload", () => {
    const payload = generateLocalFallback("3d_ct", 64, "soft_tissue", "CASE-TEST-002");
    expect(payload.modality).toBe("3d_ct");
    expect(payload.primary_roi.id).toBe("CT-ROI-01");
    expect(payload.scanner_telemetry.kvp).toBe(120);
    expect(payload.scanner_telemetry.kernel).toBe("B30f soft");
    expect(payload.primary_roi.meanHu).toBe(42);
  });
});
