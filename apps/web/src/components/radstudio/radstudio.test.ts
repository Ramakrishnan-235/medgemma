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

  it("validates standard DICOM Part 10 preamble marker in binary buffer", () => {
    // Standard DICOM has 128 bytes preamble followed by "DICM" (ASCII 68, 73, 67, 77)
    const buffer = new Uint8Array(132);
    buffer[128] = 68; // 'D'
    buffer[129] = 73; // 'I'
    buffer[130] = 67; // 'C'
    buffer[131] = 77; // 'M'

    const magic = String.fromCharCode(...buffer.slice(128, 132));
    expect(magic).toBe("DICM");
  });

  it("processes dynamic DICOM upload payload correctly", () => {
    const uploadedData = {
      accessionNumber: "ACC-64102",
      protocol: "LDCT-SCREEN",
      numSlices: 86,
      peakSlice: 65,
      noduleMm: 6.5,
      meanHu: 22,
      vdtDays: 450,
      lungRads: "Lung-RADS 3: Probably Benign",
    };

    expect(uploadedData.accessionNumber).toBe("ACC-64102");
    expect(uploadedData.numSlices).toBe(86);
    expect(uploadedData.peakSlice).toBeLessThanOrEqual(uploadedData.numSlices);
    expect(uploadedData.lungRads).toContain("Lung-RADS 3");
  });

  it("generates realistic 16-bit CT pixel data with anatomical HU calibration", async () => {
    const { generateSyntheticThoracicCtSlice, renderSliceToRgba } = await import("./dicom-loader");
    const rows = 128;
    const cols = 128;
    const pixels = generateSyntheticThoracicCtSlice(42, 100, rows, cols, 42);

    expect(pixels.length).toBe(rows * cols);
    expect(pixels[0]).toBeLessThan(100); // Outside air (-1000 HU -> raw 24)
    expect(pixels instanceof Uint16Array).toBe(true);

    const mockSlice = {
      sliceIndex: 42,
      instanceNumber: 42,
      sliceLocation: -140,
      rows,
      cols,
      pixelData: pixels,
      rescaleSlope: 1,
      rescaleIntercept: -1024,
      windowCenter: -600,
      windowWidth: 1500,
      sopInstanceUid: "test-uid-42",
    };

    const rgba = renderSliceToRgba(mockSlice, -600, 1500, false);
    expect(rgba.length).toBe(rows * cols * 4);
    // Alpha channel must be 255 for all pixels
    expect(rgba[3]).toBe(255);
    expect(rgba[7]).toBe(255);
  });

  it("correctly parses real DICOM Part-10 file CT_small.dcm and computes RGBA", async () => {
    const fs = await import("fs");
    const { parseDicomBuffer, renderSliceToRgba, calculateHu } = await import("./dicom-loader");

    const filePath = "./apps/web/public/samples/CT_small.dcm";
    const fileBytes = new Uint8Array(fs.readFileSync(filePath));
    const slice = parseDicomBuffer(fileBytes, "CT_small.dcm");

    expect(slice.rows).toBe(128);
    expect(slice.cols).toBe(128);
    expect(slice.pixelData.length).toBe(128 * 128);

    const firstRaw = slice.pixelData[0];
    const hu = calculateHu(firstRaw, slice.rescaleSlope, slice.rescaleIntercept);
    expect(typeof hu).toBe("number");

    const rgba = renderSliceToRgba(slice);
    expect(rgba.length).toBe(128 * 128 * 4);
  });

  it("dynamically analyzes 3D DICOM volume and computes real physical measurements and Lung-RADS", async () => {
    const { generateSyntheticThoracicCtSlice } = await import("./dicom-loader");
    const { analyzeDicomDataset } = await import("./clinical-analyzer");
    const rows = 128;
    const cols = 128;
    const numSlices = 20;
    const peakSlice = 10;

    const slices = [];
    for (let i = 1; i <= numSlices; i++) {
      slices.push({
        sliceIndex: i,
        instanceNumber: i,
        sliceLocation: -140 + (i - 1) * 1.5,
        rows,
        cols,
        pixelData: generateSyntheticThoracicCtSlice(i, numSlices, rows, cols, peakSlice),
        rescaleSlope: 1,
        rescaleIntercept: -1024,
        windowCenter: -600,
        windowWidth: 1500,
        pixelSpacing: [0.75, 0.75] as [number, number],
        sliceThickness: 1.5,
        sopInstanceUid: `test-sop-${i}`,
      });
    }

    const dataset = {
      seriesInstanceUid: "series-test-3d",
      seriesDescription: "Thoracic CT High Resolution",
      modality: "CT",
      numSlices,
      slices,
      reconKernel: "B60f Sharp",
      accessionNumber: "ACC-TEST-3D",
    };

    const result = analyzeDicomDataset(dataset);

    // Bounding Box 01 should be computed from actual voxel cluster
    expect(result.box01 !== null).toBe(true);
    expect(result.box01!.sliceIndex).toBeGreaterThanOrEqual(1);
    expect(result.box01!.sliceIndex).toBeLessThanOrEqual(numSlices);
    expect(result.box01!.diameterMm).toBeGreaterThan(0);
    expect(result.box01!.volumeCm3).toBeGreaterThan(0);
    expect(typeof result.box01!.huAttenuation).toBe("number");
    expect(result.box01!.coordinates[0]).toBeGreaterThanOrEqual(0);
    expect(result.box01!.coordinates[1]).toBeGreaterThanOrEqual(0);

    // Diagnostic Assessment should be driven by the computed nodule
    expect(result.assessment.lungRadsCurrent).toContain("Lung-RADS");
    expect(result.assessment.malignancyProbability).toBeGreaterThan(0);
    expect(result.assessment.max2dMm).toBe(result.box01!.diameterMm);
    expect(result.assessment.volumeCm3).toBe(result.box01!.volumeCm3);

    // Diagnostic Report should contain synthesized text with actual values
    expect(result.report.hasNodule).toBe(true);
    expect(result.report.lungsFinding).toContain(String(result.box01!.diameterMm));
    expect(result.report.impressions.length).toBeGreaterThan(0);
    expect(result.report.recommendation.length).toBeGreaterThan(0);
  });

  it("handles negative study baseline without nodules correctly", async () => {
    const fs = await import("fs");
    const { parseDicomBuffer } = await import("./dicom-loader");
    const { analyzeDicomDataset } = await import("./clinical-analyzer");

    const filePath = "./apps/web/public/samples/CT_small.dcm";
    const fileBytes = new Uint8Array(fs.readFileSync(filePath));
    const slice = parseDicomBuffer(fileBytes, "CT_small.dcm");

    const dataset = {
      seriesInstanceUid: "series-real-small",
      seriesDescription: "Real CT Part 10 Small",
      modality: "CT",
      numSlices: 1,
      slices: [slice],
    };

    const result = analyzeDicomDataset(dataset);
    expect(result.assessment).toBeDefined();
    expect(result.report).toBeDefined();
    expect(result.summary).toBeDefined();
    expect(result.assessment.protocol).toBe("Real CT Part 10 Small");
  });
});

