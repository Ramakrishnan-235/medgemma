import * as dicomParser from "dicom-parser";
import JSZip from "jszip";
import type { DicomSlice, DicomSeriesDataset } from "./types";

/**
 * Calculates true clinical Hounsfield Unit (HU) from raw 16-bit CT pixel value.
 * HU = rawPixel * RescaleSlope + RescaleIntercept
 */
export function calculateHu(rawPixel: number, rescaleSlope: number, rescaleIntercept: number): number {
  return rawPixel * rescaleSlope + rescaleIntercept;
}

/**
 * Maps a calibrated Hounsfield Unit (HU) to 8-bit display grayscale [0, 255]
 * based on clinical window center (WC) and window width (WW).
 * 
 * intensity = clamp( ((HU - (WC - WW / 2)) / WW) * 255, 0, 255 )
 */
export function windowHuToGrayscale(
  hu: number,
  windowCenter: number,
  windowWidth: number
): number {
  const half = windowWidth / 2;
  const minHu = windowCenter - half;
  const maxHu = windowCenter + half;

  if (hu <= minHu) return 0;
  if (hu >= maxHu) return 255;
  return Math.round(((hu - minHu) / windowWidth) * 255);
}

/**
 * Converts a calibrated 16-bit CT DicomSlice into an 8-bit RGBA pixel buffer
 * suitable for direct painting via canvas 2D ctx.putImageData().
 */
export function renderSliceToRgba(
  slice: DicomSlice,
  windowCenter: number = slice.windowCenter,
  windowWidth: number = slice.windowWidth,
  invert: boolean = false,
  output?: Uint8ClampedArray
): Uint8ClampedArray {
  const numPixels = slice.rows * slice.cols;
  const rgba = output ?? new Uint8ClampedArray(numPixels * 4);
  const { pixelData, rescaleSlope, rescaleIntercept } = slice;
  const half = windowWidth / 2;
  const minHu = windowCenter - half;
  const maxHu = windowCenter + half;

  for (let i = 0; i < numPixels; i++) {
    const raw = pixelData[i];
    const hu = raw * rescaleSlope + rescaleIntercept;
    let gray: number;

    if (hu <= minHu) {
      gray = 0;
    } else if (hu >= maxHu) {
      gray = 255;
    } else {
      gray = Math.round(((hu - minHu) / windowWidth) * 255);
    }

    if (invert) {
      gray = 255 - gray;
    }

    const offset = i * 4;
    rgba[offset] = gray;
    rgba[offset + 1] = gray;
    rgba[offset + 2] = gray;
    rgba[offset + 3] = 255; // Full alpha
  }

  return rgba;
}

/**
 * Parses a raw binary DICOM buffer into a typed DicomSlice data structure.
 */
export function parseDicomBuffer(buffer: Uint8Array, fileName: string): DicomSlice {
  const dataSet = dicomParser.parseDicom(buffer);

  // Geometric dimensions
  const rows = dataSet.uint16("x00280010") ?? 512;
  const cols = dataSet.uint16("x00280011") ?? 512;
  const pixelRep = dataSet.uint16("x00280103") ?? 0;

  // Radiometric calibration
  const rescaleSlopeStr = dataSet.string("x00281053");
  const rescaleSlope = rescaleSlopeStr ? parseFloat(rescaleSlopeStr) : 1;

  const rescaleInterceptStr = dataSet.string("x00281052");
  const rescaleIntercept = rescaleInterceptStr ? parseFloat(rescaleInterceptStr) : 0;

  // Instance / slice indexing
  const instanceNumberStr = dataSet.string("x00200013");
  const instanceNumber = instanceNumberStr ? parseInt(instanceNumberStr, 10) : 1;

  const sopInstanceUid =
    dataSet.string("x00080018") || `instance-${Math.random().toString(36).substring(2, 9)}`;

  // Spatial location: Prefer ImagePositionPatient[2] (Z mm) over SliceLocation tag
  const ippStr = dataSet.string("x00200032");
  let sliceLocation: number;
  if (ippStr) {
    const parts = ippStr.split("\\").map(Number);
    if (parts.length >= 3 && !isNaN(parts[2])) {
      sliceLocation = parts[2];
    } else {
      sliceLocation = instanceNumber;
    }
  } else {
    const slStr = dataSet.string("x00201041");
    if (slStr && !isNaN(parseFloat(slStr))) {
      sliceLocation = parseFloat(slStr);
    } else {
      sliceLocation = instanceNumber;
    }
  }

  // Clinical Window Center & Width (0028,1050 / 0028,1051)
  const wcStr = dataSet.string("x00281050");
  const wwStr = dataSet.string("x00281051");
  const windowCenter = wcStr ? parseFloat(wcStr.split("\\")[0]) : -600;
  const windowWidth = wwStr ? parseFloat(wwStr.split("\\")[0]) : 1500;

  // Pixel Spacing (0028,0030)
  const spacingStr = dataSet.string("x00280030");
  let pixelSpacing: [number, number] | undefined = undefined;
  if (spacingStr) {
    const sp = spacingStr.split("\\").map(Number);
    if (sp.length >= 2 && !isNaN(sp[0]) && !isNaN(sp[1])) {
      pixelSpacing = [sp[0], sp[1]];
    }
  }

  // Slice Thickness (0018,0050)
  const thickStr = dataSet.string("x00180050");
  const sliceThickness = thickStr && !isNaN(parseFloat(thickStr)) ? parseFloat(thickStr) : undefined;

  // Extract raw 16-bit Pixel Data (7FE0, 0010)
  const pixelElement = dataSet.elements.x7fe00010;
  if (!pixelElement || pixelElement.dataOffset === undefined || pixelElement.length === undefined) {
    throw new Error(`Missing or invalid pixel data element in ${fileName}`);
  }

  // Slice an independent ArrayBuffer to ensure 2-byte alignment and enable GC of larger input
  const sliceBuffer = buffer.buffer.slice(
    buffer.byteOffset + pixelElement.dataOffset,
    buffer.byteOffset + pixelElement.dataOffset + pixelElement.length
  );

  const pixelData = pixelRep === 1 ? new Int16Array(sliceBuffer) : new Uint16Array(sliceBuffer);

  return {
    sliceIndex: 1, // Normalized after sorting
    instanceNumber,
    sliceLocation,
    rows,
    cols,
    pixelData,
    rescaleSlope: isNaN(rescaleSlope) ? 1 : rescaleSlope,
    rescaleIntercept: isNaN(rescaleIntercept) ? 0 : rescaleIntercept,
    windowCenter: isNaN(windowCenter) ? -600 : windowCenter,
    windowWidth: isNaN(windowWidth) ? 1500 : windowWidth,
    pixelSpacing,
    sliceThickness,
    sopInstanceUid,
    seriesInstanceUid: dataSet.string("x0020000e"),
    studyInstanceUid: dataSet.string("x0020000d"),
    modality: dataSet.string("x00080060"),
    seriesDescription: dataSet.string("x0008103e"),
    reconKernel: dataSet.string("x00181210"),
    patientName: dataSet.string("x00100010"),
  };
}

/**
 * Ingests an array of uploaded files (single DCMs, series stacks, or .zip archives).
 * Fully decompresses ZIP archives, filters non-DICOM entries, parses calibrated pixels,
 * and sorts slices strictly ascending by spatial Z-location.
 */
export async function processDicomUpload(
  files: (File | { name: string; arrayBuffer: () => Promise<ArrayBuffer>; type?: string })[],
  onProgress?: (percent: number, stage: string) => void
): Promise<DicomSeriesDataset> {
  if (!files || files.length === 0) {
    throw new Error("No files selected for DICOM upload.");
  }

  const rawBuffers: { name: string; buffer: Uint8Array }[] = [];

  // Check for ZIP archives
  const zipFiles = files.filter(
    (f) =>
      f.name.toLowerCase().endsWith(".zip") ||
      (typeof f.type === "string" && (f.type.includes("zip") || f.type.includes("compressed")))
  );

  if (zipFiles.length > 0) {
    for (let zIdx = 0; zIdx < zipFiles.length; zIdx++) {
      const zFile = zipFiles[zIdx];
      onProgress?.(10, `Opening ZIP archive: ${zFile.name}...`);
      const arrayBuf = await zFile.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuf);

      const entries: { path: string; entry: JSZip.JSZipObject }[] = [];
      zip.forEach((path, entry) => {
        if (!entry.dir) {
          entries.push({ path, entry });
        }
      });

      const totalEntries = entries.length;
      for (let i = 0; i < totalEntries; i++) {
        const { path, entry } = entries[i];
        if (i % 25 === 0 || i === totalEntries - 1) {
          const pct = Math.min(60, 15 + Math.round((i / totalEntries) * 45));
          onProgress?.(pct, `Decompressing slice ${i + 1}/${totalEntries} (${entry.name})...`);
        }

        const uint8 = await entry.async("uint8array");
        rawBuffers.push({ name: path, buffer: uint8 });
      }
    }
  }

  // Include non-zip files
  const nonZipFiles = files.filter(
    (f) =>
      !f.name.toLowerCase().endsWith(".zip") &&
      (!f.type || (!f.type.includes("zip") && !f.type.includes("compressed")))
  );

  for (let i = 0; i < nonZipFiles.length; i++) {
    const f = nonZipFiles[i];
    onProgress?.(
      Math.min(60, 20 + Math.round((i / Math.max(1, nonZipFiles.length)) * 40)),
      `Reading file ${f.name}...`
    );
    const arrayBuf = await f.arrayBuffer();
    rawBuffers.push({ name: f.name, buffer: new Uint8Array(arrayBuf) });
  }

  if (rawBuffers.length === 0) {
    throw new Error("No files extracted from upload.");
  }

  onProgress?.(65, `Decoding ${rawBuffers.length} DICOM headers & calibrated pixels...`);

  const slices: DicomSlice[] = [];
  let seriesInstanceUid: string | undefined;
  let studyInstanceUid: string | undefined;
  let modality: string | undefined;
  let seriesDescription: string | undefined;
  let reconKernel: string | undefined;
  let patientName: string | undefined;

  for (let i = 0; i < rawBuffers.length; i++) {
    const item = rawBuffers[i];
    const buf = item.buffer;

    // Check for 'DICM' preamble marker at byte offset 128
    const hasPreamble =
      buf.length >= 132 &&
      buf[128] === 0x44 && // 'D'
      buf[129] === 0x49 && // 'I'
      buf[130] === 0x43 && // 'C'
      buf[131] === 0x4d;   // 'M'

    const hasDcmExt = item.name.toLowerCase().endsWith(".dcm") || item.name.toLowerCase().endsWith(".dicom");

    // Skip non-DICOM artifacts (e.g. CITATION.txt, hidden files)
    if (!hasPreamble && !hasDcmExt) {
      continue;
    }

    try {
      const slice = parseDicomBuffer(buf, item.name);
      slices.push(slice);

      if (!seriesInstanceUid && slice.seriesInstanceUid) {
        seriesInstanceUid = slice.seriesInstanceUid;
      }
      if (!studyInstanceUid && slice.studyInstanceUid) {
        studyInstanceUid = slice.studyInstanceUid;
      }
      if (!modality && slice.modality) {
        modality = slice.modality;
      }
      if (!seriesDescription && slice.seriesDescription) {
        seriesDescription = slice.seriesDescription;
      }
      if (!reconKernel && slice.reconKernel) {
        reconKernel = slice.reconKernel;
      }
      if (!patientName && slice.patientName) {
        patientName = slice.patientName;
      }
    } catch {
      // Gracefully ignore non-DICOM text files or unparseable artifacts
    }
  }

  if (slices.length === 0) {
    throw new Error("No valid DICOM CT slices could be parsed from the provided files.");
  }

  onProgress?.(85, "Sorting slices ascending by anatomical Z-coordinate...");

  // Sort slices strictly ascending by sliceLocation (or instanceNumber if locations equal)
  slices.sort((a, b) => {
    if (Math.abs(a.sliceLocation - b.sliceLocation) > 0.001) {
      return a.sliceLocation - b.sliceLocation;
    }
    return a.instanceNumber - b.instanceNumber;
  });

  // Assign sequential 1-based slice indices
  for (let idx = 0; idx < slices.length; idx++) {
    slices[idx].sliceIndex = idx + 1;
  }

  onProgress?.(100, `Successfully ingested ${slices.length} calibrated CT slices.`);

  return {
    seriesInstanceUid: seriesInstanceUid || slices[0].sopInstanceUid || "series-default",
    studyInstanceUid,
    seriesDescription: seriesDescription || (slices.length > 1 ? "CT Thorax Volumetric" : "CT Single Instance"),
    modality: modality || "CT",
    numSlices: slices.length,
    slices,
    reconKernel: reconKernel || "B60f Sharp",
    patientName,
  };
}

/**
 * Generates an anatomically plausible 16-bit CT slice pixel array for synthetic/preset thorax series.
 * Rescale: slope=1, intercept=-1024 (HU = raw - 1024)
 */
export function generateSyntheticThoracicCtSlice(
  sliceIndex: number,
  totalSlices: number,
  rows: number = 256,
  cols: number = 256,
  peakSlice: number = 42
): Uint16Array {
  const pixelData = new Uint16Array(rows * cols);
  const cx = cols / 2;
  const cy = rows / 2;
  const zNorm = totalSlices > 1 ? sliceIndex / totalSlices : 0.5;

  // Lung volume varies with Z-depth (smaller at apex and base, larger mid-thorax)
  const lungScale = Math.sin(Math.max(0.05, Math.min(0.95, zNorm)) * Math.PI) * 0.85 + 0.15;

  for (let r = 0; r < rows; r++) {
    const ny = (r - cy) / cy; // -1 to 1
    const rOffset = r * cols;

    for (let c = 0; c < cols; c++) {
      const nx = (c - cx) / cx; // -1 to 1

      // Outside air (-1000 HU)
      let hu = -1000;

      // Thoracic body contour (ellipse)
      const bodyDist = (nx * nx) / (0.84 * 0.84) + (ny * ny) / (0.68 * 0.68);

      if (bodyDist <= 1.0) {
        if (bodyDist > 0.92) {
          // Subcutaneous fat (-110 HU)
          hu = -110;
        } else if (bodyDist > 0.78) {
          // Thoracic wall muscle (+40 HU)
          hu = 40;
        } else {
          // Mediastinum base (+40 HU)
          hu = 40;
        }

        // Ribs (bilateral peripheral bone +750 HU)
        const ribAngle = Math.atan2(ny, nx);
        const ribDist = Math.sqrt(nx * nx + ny * ny);
        if (ribDist > 0.68 && ribDist < 0.84) {
          if (Math.sin(ribAngle * 6) > 0.65) {
            hu = 750;
          }
        }

        // Spine (posterior midline bone +850 HU)
        const spineDist = Math.sqrt(nx * nx + Math.pow(ny - 0.52, 2));
        if (spineDist < 0.14) {
          if (spineDist < 0.05) {
            hu = 15; // Spinal canal
          } else {
            hu = 850; // Vertebral body bone
          }
        }

        // Sternum (anterior midline bone +650 HU)
        const sternumDist = Math.sqrt(nx * nx + Math.pow(ny + 0.58, 2));
        if (sternumDist < 0.07) {
          hu = 650;
        }

        // Right Lung (anatomical right = image left, nx < 0)
        const rLungDist =
          Math.pow((nx + 0.38) / (0.28 * lungScale), 2) +
          Math.pow((ny + 0.05) / (0.42 * lungScale), 2);

        // Left Lung (anatomical left = image right, nx > 0)
        const lLungDist =
          Math.pow((nx - 0.38) / (0.28 * lungScale), 2) +
          Math.pow((ny + 0.08) / (0.40 * lungScale), 2);

        if (rLungDist <= 1.0) {
          // Lung parenchyma (-750 HU)
          hu = -750;
          // Pulmonary markings
          if (Math.sin(nx * 35) * Math.cos(ny * 35) > 0.82) {
            hu = -120;
          }
          // Spiculated nodule near peakSlice in Right Upper Lobe
          const sliceDiff = Math.abs(sliceIndex - peakSlice);
          if (sliceDiff <= 6) {
            const noduleDist = Math.sqrt(Math.pow(nx + 0.32, 2) + Math.pow(ny + 0.18, 2));
            const radius = 0.045 * (1 - sliceDiff * 0.14);
            if (noduleDist < radius) {
              hu = 45; // Solid nodule core (+45 HU)
            } else if (noduleDist < radius * 1.6) {
              hu = -320; // Ground glass halo
            }
          }
        } else if (lLungDist <= 1.0) {
          // Left Lung parenchyma (-750 HU)
          hu = -750;
          if (Math.sin(nx * 32) * Math.cos(ny * 32) > 0.84) {
            hu = -140;
          }
          // Secondary nodule near slice 65
          const nodule2SliceDiff = Math.abs(sliceIndex - 65);
          if (nodule2SliceDiff <= 4) {
            const nodule2Dist = Math.sqrt(Math.pow(nx - 0.44, 2) + Math.pow(ny - 0.22, 2));
            if (nodule2Dist < 0.025) {
              hu = 22;
            }
          }
        }
      }

      // Convert HU to raw 16-bit value: raw = hu - rescaleIntercept
      // with rescaleIntercept = -1024, raw = hu + 1024
      const raw = Math.max(0, Math.min(65535, Math.round(hu + 1024)));
      pixelData[rOffset + c] = raw;
    }
  }

  return pixelData;
}
