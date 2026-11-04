# Project: MedGemma Real DICOM Ingestion & CtViewport Overhaul

## Architecture
- **Framework**: Next.js 16.4.3 / React 19.3.0 in `apps/web/`.
- **Package Manager / Runtime**: Bun 1.4.4.
- **DICOM & Archive Stack**:
  - `dicom-parser` (^1.8.21) for zero-dependency DICOM header & 16-bit PCM pixel buffer extraction.
  - `jszip` (^3.10.2) for fast in-browser decompression of multi-slice CT series archives.
- **Rendering Engine**:
  - HTML5 2D `<canvas width={512} height={512}>` with direct `ImageData` (RGBA) pixel manipulation.
  - Radiometric Hounsfield Unit (HU) windowing:
    $HU = rawPixel \times RescaleSlope + RescaleIntercept$
    $intensity = clamp(\frac{HU - (WindowCenter - WindowWidth / 2)}{WindowWidth} \times 255, 0, 255)$.
- **State Management**:
  - React state encapsulated in `use-radstudio-state.ts`.
  - `activeDataset: DicomSeriesDataset | null` (defaults to `null` on mount).
  - `hasStudy: boolean` (derived from `activeDataset !== null`).
- **Empty State UX**:
  - Modern high-density monochrome dropzone with icon, title, description, and "Upload DICOM" action button.
  - Drag-and-drop listener on viewport container.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Dependency Setup | Add `dicom-parser` and `jszip` to `apps/web/package.json` | M1 | Survey (explorer_2) |
| 2 | DICOM Ingestion Pipeline | Implement `dicom-loader.ts` to parse single `.dcm` and `.zip` archives, extract 16-bit pixels, skip `CITATION.txt`, and sort by Z / InstanceNumber | M1 | ORIGINAL_REQUEST §R2 |
| 3 | Upload Modal ZIP & Real DICOM Support | Update `DicomUploadModal.tsx` file accept, replace mock timeout with `processDicomUpload`, provide stage progress callbacks, pass `DicomSeriesDataset` | M1 | ORIGINAL_REQUEST §R2 |
| 4 | RadStudio State Store Integration | Add `activeDataset`, `hasStudy`, dynamic `totalSlices`, and `handleDicomUploaded` in `use-radstudio-state.ts` | M1 | Survey (explorer_1, explorer_2) |
| 5 | Viewport Default Empty State | When `!activeDataset`, render "Upload DICOM" dropzone and suppress simulated thoracic SVG diagram | M2 | ORIGINAL_REQUEST §R1 |
| 6 | Real DICOM Canvas Rendering | In `CtViewport.tsx`, replace static SVG with HTML5 `<canvas>` rendering calibrated 16-bit CT slices to 8-bit grayscale via `ImageData` | M2 | ORIGINAL_REQUEST §R2 |
| 7 | Viewport Interactions & HU Windowing | Mouse wheel scrolling (`onWheel`), range slider scrubbing, cineloop, calibrated HUD (Z-position, real HU on hover), and HU window/level presets (Lung, Bone, Mediastinal, Brain) | M2 | ORIGINAL_REQUEST §R2 |
| 8 | Unit & Parser Test Suite | Automated tests in `radstudio.test.ts` for empty state, single instance parsing, series unzipping & sorting, and HU windowing calculation | M1 | Survey (explorer_3) |
| 9 | NLST Verification & E2E Validation | Pass verification against `ct-lung-screening-nlst-instance.dcm` and `ct-lung-screening-nlst-series.zip`, verify type-check and Next.js build | M3 | ORIGINAL_REQUEST §Acceptance |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | DICOM Ingestion Engine & State Pipeline | Dependencies (`dicom-parser`, `jszip`), data contracts in `types.ts`, `dicom-loader.ts` parser, `DicomUploadModal.tsx` real ingestion, `use-radstudio-state.ts` state bindings, parser unit tests | none | IN_PROGRESS |
| M2 | CtViewport Empty State & Real Scan Canvas Rendering | Default empty state dropzone, HTML5 `<canvas>` CT slice rendering, real HU window/leveling, mouse wheel scrolling, slider scrubbing, calibrated HUD readouts | M1 | PLANNED |
| M3 | E2E Testing, NLST Verification & Hardening | Full acceptance verification with `ct-lung-screening-nlst-instance.dcm` and `ct-lung-screening-nlst-series.zip`, `bun test`, `bun run type-check`, `bun run build`, adversarial review | M2 | PLANNED |

## Interface Contracts
### `dicom-loader.ts` ↔ State Store (`use-radstudio-state.ts`)
```typescript
export interface DicomSlice {
  sliceIndex: number; // 1-based (1..numSlices)
  instanceNumber: number;
  sliceLocation: number; // Z-coordinate in mm
  rows: number;
  cols: number;
  pixelData: Int16Array | Uint16Array;
  rescaleSlope: number;
  rescaleIntercept: number;
  windowCenter: number;
  windowWidth: number;
  pixelSpacing?: [number, number];
  sliceThickness?: number;
  sopInstanceUid: string;
}

export interface DicomSeriesDataset {
  seriesInstanceUid: string;
  seriesDescription: string;
  modality: string;
  numSlices: number;
  slices: DicomSlice[]; // Sorted ascending by sliceLocation
  reconKernel?: string;
  patientName?: string;
  studyInstanceUid?: string;
}

export function parseDicomBuffer(buffer: Uint8Array, fileName: string): DicomSlice;
export async function processDicomUpload(
  files: File[],
  onProgress?: (percent: number, stage: string) => void
): Promise<DicomSeriesDataset>;
```

### State Store ↔ Viewport (`CtViewport.tsx`)
- `hasStudy: boolean`: `false` when no study uploaded; `true` when `activeDataset !== null`.
- `activeDataset: DicomSeriesDataset | null`: contains calibrated slice data and dimensions.
- `slice: number`: 1-based index into `activeDataset.slices`.
- `totalSlices: number`: matches `activeDataset.numSlices` (0 if no study).
- `setSlice(n: number)`: updates active slice index.
- `wlPreset`: `"lung" | "bone" | "mediastinal" | "brain"`.
- `onOpenUploadModal()`: opens `DicomUploadModal`.

## Code Layout
- `apps/web/package.json`: Dependency manifests (`dicom-parser`, `jszip`).
- `apps/web/src/components/radstudio/types.ts`: TypeScript contracts for `DicomSlice`, `DicomSeriesDataset`, and viewport props.
- `apps/web/src/components/radstudio/dicom-loader.ts`: Parsing pipeline (ZIP decompression, DICOM tags, 16-bit pixel buffers, spatial Z-sort).
- `apps/web/src/components/radstudio/DicomUploadModal.tsx`: Upload modal with `.zip` support and progress reporting.
- `apps/web/src/components/radstudio/use-radstudio-state.ts`: React state hook managing study lifecycle, active dataset, and viewport parameters.
- `apps/web/src/components/radstudio/CtViewport.tsx`: Viewport component rendering empty-state dropzone or real CT scan canvas.
- `apps/web/src/components/radstudio/radstudio.test.ts`: Automated unit test suite.
