# E2E Test Infra: MedGemma Real DICOM Ingestion & CtViewport Overhaul

## Test Philosophy
- Opaque-box, requirement-driven testing. Derived from user requirements in `ORIGINAL_REQUEST.md`.
- Acceptance-driven verification against real clinical imaging datasets (`ct-lung-screening-nlst-instance.dcm` and `ct-lung-screening-nlst-series.zip`).
- Methodology: Category-Partition, Boundary Value Analysis, Pairwise Interaction, and Real-World NLST Clinical Workload Testing.

## Feature Inventory & Test Coverage Goals
| # | Feature | Requirement | Tier 1 | Tier 2 | Tier 3 | Tier 4 |
|---|---------|-------------|:------:|:------:|:------:|:------:|
| 1 | Default Viewport Empty State | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ | ✓ |
| 2 | Single DICOM Ingestion (`.dcm`) | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ | ✓ |
| 3 | Series Archive Ingestion (`.zip`) | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ | ✓ |
| 4 | Real CT Canvas Pixel Rendering | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ | ✓ |
| 5 | Window/Level HU Contrast Mapping | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ | ✓ |
| 6 | Slice Navigation & Wheel Scrolling | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ | ✓ |

## Test Architecture
- Test Runner: `bun test` in `apps/web/`.
- Test Files:
  - `apps/web/src/components/radstudio/radstudio.test.ts`
  - `apps/web/src/components/radstudio/dicom-loader.test.ts`
- Pass/Fail Semantics:
  - Zero test failures (`0 fail`).
  - Zero TypeScript compiler diagnostics (`bun run type-check`).
  - Clean Next.js production build (`bun run build`).

## Test Tier Definitions
- **Tier 1 - Feature Coverage**:
  - Empty state displays dropzone with "Upload DICOM" prompt.
  - Zero simulated/demo SVG slices rendered when `hasStudy === false`.
  - Single instance `.dcm` parses headers and displays 512x512 slice on canvas.
  - Series archive `.zip` unzips all 150 instances and sets total slices to 150.
  - Slices are sorted strictly ascending by spatial Z-coordinate / InstanceNumber.
- **Tier 2 - Boundary & Corner Cases**:
  - Non-DICOM files in archive (`CITATION.txt`) gracefully skipped without error.
  - Out-of-order zip archive entry names (`instance-0001.dcm` = slice 114) correctly re-sequenced.
  - Single slice boundary: navigation buttons disabled when `totalSlices === 1`.
  - Min/Max slice limits: slider clamped at `1` and `totalSlices`.
  - Raw 16-bit negative Hounsfield Units (-1024 HU for air) correctly clamped without underflow.
- **Tier 3 - Cross-Feature Combinations**:
  - Window/level preset switching (Lung, Bone, Mediastinal) while cineloop is actively playing.
  - Inverting color scale (`isInverted`) while dragging slice slider.
  - Mouse wheel scrolling while hover readout displays calibrated HU.
  - Uploading single instance, then uploading 150-slice series archive to verify clean dataset replacement.
- **Tier 4 - Real-World Application Scenarios**:
  - Full ingestion of NLST Thoracic CT instance: `ct-lung-screening-nlst-instance.dcm` (Slice 107, Z = -337.4mm).
  - Full volumetric ingestion of 44.6 MB NLST series: `ct-lung-screening-nlst-series.zip` (150 slices, 2.0mm thickness, Z = -549.4mm to -251.4mm).
  - Radiologist review simulation: Scrolling through apical-to-basilar lung fields and inspecting parenchymal structures using lung window (W: 1500, C: -600).
