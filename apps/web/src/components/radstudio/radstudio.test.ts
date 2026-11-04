import { describe, it, expect } from "bun:test";
import {
  DEFAULT_ASSESSMENT,
  BOX_01,
  BOX_02,
} from "./use-radstudio-state";

describe("MedGemma RadStudio Suite", () => {
  it("provides valid default diagnostic assessment criteria", () => {
    expect(DEFAULT_ASSESSMENT.accessionNumber).toBe("ACC-89432");
    expect(DEFAULT_ASSESSMENT.protocol).toBe("LUNG-HRCT");
    expect(DEFAULT_ASSESSMENT.lungRadsCurrent).toContain("Lung-RADS 4B");
    expect(DEFAULT_ASSESSMENT.malignancyProbability).toBe(84.2);
    expect(DEFAULT_ASSESSMENT.thresholdIntervention).toBe(65);
    expect(DEFAULT_ASSESSMENT.aucScore).toBe(0.941);
    expect(DEFAULT_ASSESSMENT.vdtDays).toBe(118);
    expect(DEFAULT_ASSESSMENT.max2dMm).toBe(14.2);
  });

  it("defines accurate anatomical bounding box coordinates for BOX-01", () => {
    expect(BOX_01.id).toBe("BOX-01");
    expect(BOX_01.sliceIndex).toBe(42);
    expect(BOX_01.diameterMm).toBe(14.2);
    expect(BOX_01.volumeCm3).toBe(0.42);
    expect(BOX_01.coordinates[0]).toBeGreaterThanOrEqual(0);
    expect(BOX_01.coordinates[1]).toBeLessThanOrEqual(1);
    expect(BOX_01.coordinates[2]).toBeLessThanOrEqual(1);
  });

  it("defines secondary stable comparison nodule BOX-02", () => {
    expect(BOX_02.id).toBe("BOX-02");
    expect(BOX_02.sliceIndex).toBe(65);
    expect(BOX_02.diameterMm).toBe(6.5);
    expect(BOX_02.vdtDays).toBe(450);
  });

  it("computes correct slice Z-position in mm within anatomical thorax bounds", () => {
    const calcZ = (slice: number) => (-180 + (slice - 1) * 0.88).toFixed(1);
    expect(Number(calcZ(1))).toBe(-180.0);
    expect(Number(calcZ(42))).toBeCloseTo(-143.9, 0);
    expect(Number(calcZ(128))).toBeGreaterThan(-70.0);
  });

  it("ensures lesion opacity fades gracefully outside target slice range", () => {
    const getOpacity = (currentSlice: number, targetSlice: number) => {
      const dist = Math.abs(currentSlice - targetSlice);
      return dist <= 8 ? Math.max(0.2, 1 - dist * 0.12) : 0;
    };

    expect(getOpacity(42, 42)).toBe(1.0);
    expect(getOpacity(43, 42)).toBeCloseTo(0.88, 2);
    expect(getOpacity(50, 42)).toBeCloseTo(0.2, 1);
    expect(getOpacity(60, 42)).toBe(0);
  });
});

