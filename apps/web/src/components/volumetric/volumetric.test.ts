import { describe, expect, it } from "bun:test";
import { generateLocalFallback, generateLocalHistogram, parseBoundingBox1000 } from "./api";

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

  it("converts [ymin, xmin, ymax, xmax] 1000-based boxes to canvas pixel coordinates", () => {
    const box1000 = { ymin: 200, xmin: 300, ymax: 600, xmax: 800 };
    const canvasWidth = 500;
    const canvasHeight = 400;

    const px = parseBoundingBox1000(box1000, canvasWidth, canvasHeight);
    expect(px.left).toBe(150); // (300 / 1000) * 500
    expect(px.top).toBe(80); // (200 / 1000) * 400
    expect(px.width).toBe(250); // ((800 - 300) / 1000) * 500
    expect(px.height).toBe(160); // ((600 - 200) / 1000) * 400
  });

  it("defensively handles malformed, inverted, or negative bounding boxes without NaN or negative sizes", () => {
    // Malformed inverted coordinates
    const invertedBox = { ymin: 800, xmin: 900, ymax: 200, xmax: 300 };
    const pxInverted = parseBoundingBox1000(invertedBox, 500, 400);
    expect(pxInverted.width).toBeGreaterThanOrEqual(0);
    expect(pxInverted.height).toBeGreaterThanOrEqual(0);
    expect(Number.isNaN(pxInverted.left)).toBe(false);
    expect(Number.isNaN(pxInverted.top)).toBe(false);

    // Negative / out-of-bounds coordinates
    const outOfBoundsBox = { ymin: -50, xmin: -100, ymax: 1200, xmax: 1500 };
    const pxOutOfBounds = parseBoundingBox1000(outOfBoundsBox, 500, 400);
    expect(pxOutOfBounds.left).toBe(0);
    expect(pxOutOfBounds.top).toBe(0);
    expect(pxOutOfBounds.width).toBeLessThanOrEqual(500);
    expect(pxOutOfBounds.height).toBeLessThanOrEqual(400);

    // Zero or negative canvas dimensions
    const pxZeroCanvas = parseBoundingBox1000({ ymin: 100, xmin: 100, ymax: 500, xmax: 500 }, 0, 0);
    expect(pxZeroCanvas.width).toBe(0);
    expect(pxZeroCanvas.height).toBe(0);
    expect(pxZeroCanvas.left).toBe(0);
    expect(pxZeroCanvas.top).toBe(0);
  });
});
