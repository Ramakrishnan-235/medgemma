# Implementation Plan: MedGemma Clinical Imaging Intelligence Suite

## Overview
Implement the 5 requested core capabilities for MedGemma:
1. **Free-Form Radiology Reports**: Multi-organ narrative Findings & Impression generator and longitudinal comparison reports (RECIST 1.1 size/density/volume progression).
2. **Structured Data**: Constrained JSON schema output engine and HL7 FHIR R4 DiagnosticReport & Observation bundle serialization.
3. **Diagnostic Classifications & Risk Scores**: ACR Lung-RADS v2022 assessment (categories 1-4X + logit risk scores) and CT-RATE 18 multi-organ abnormality classification.
4. **Interactive Visual Question Answering (VQA)**: Targeted axial slice and tissue window clinical Q&A.
5. **Anatomical Bounding Box Coordinates (Visual Grounding)**: Normalized `[ymin, xmin, ymax, xmax]` coordinates and frontend rendering overlays on the DICOM/Canvas viewport.

## Architecture Decisions
- **Decoupled Service Modules**: Isolate each clinical reasoning capability in its own service file in `apps/api/app/services/` (`ct_report_generator.py`, `fhir_exporter.py`, `ct_classifiers.py`, `targeted_slice_vqa.py`, `visual_grounding.py`), preventing bloated monolithic files.
- **Strict Pydantic v2 Contract**: Centralize all models in `apps/api/app/schemas/ct_clinical.py` with rigorous validation (e.g. non-inverted bounding boxes, valid Lung-RADS categories).
- **FHIR R4 Standard Compliance**: Structure diagnostic outputs using official LOINC codes (`24627-2`, `79040-2`, `24606-6`) and UCUM measurement units (`mm`, `cm3`, `[HU]`).
- **Zero-DB Test Execution**: Ensure core clinical suite test suite passes deterministically without requiring a live external PostgreSQL or GPU cluster.
- **Progressive Frontend Integration**: Render normalized bounding boxes using an SVG overlay atop the canvas in `AxialViewport.tsx` with interactive slice VQA controls in `VolumetricSidebar.tsx`.

## Task List

### Phase 1: Foundations & Schemas
- [ ] Task 1: Clinical Intelligence Schemas & Constrained Models (`apps/api/app/schemas/ct_clinical.py`)

### Checkpoint: Foundation
- [ ] Schema unit tests pass: `.\.venv\Scripts\python.exe -m pytest tests/test_ct_clinical_schemas.py`

### Phase 2: Core Clinical Services (Backend)
- [ ] Task 2: Free-Form Narrative Radiology & Longitudinal Comparison Engine (`apps/api/app/services/ct_report_generator.py`)
- [ ] Task 3: Constrained JSON Decoding & FHIR R4 Bundle Exporter (`apps/api/app/services/fhir_exporter.py`)
- [ ] Task 4: Diagnostic Classifications (Lung-RADS v2022 & CT-RATE 18) (`apps/api/app/services/ct_classifiers.py`)
- [ ] Task 5: Interactive Visual Question Answering (Targeted Slice VQA) (`apps/api/app/services/targeted_slice_vqa.py`)
- [ ] Task 6: Anatomical Bounding Box Visual Grounding & API Endpoints (`apps/api/app/services/visual_grounding.py`, `apps/api/app/api/v1/volumetric.py`)

### Checkpoint: Backend Complete
- [ ] Backend services and endpoints unit tests pass

### Phase 3: Frontend Overlays & Interactive VQA
- [ ] Task 7: Frontend Visual Grounding Overlay & Interactive VQA Viewport Integration (`apps/web/src/components/volumetric/`)

### Checkpoint: Frontend Complete
- [ ] Frontend bun tests and type checks pass

### Phase 4: Full End-to-End Verification
- [ ] Task 8: End-to-End Volumetric API & Clinical Workspace Integration Verification (`tests/test_volumetric_api.py`)

### Checkpoint: Final
- [ ] Full regression suite passes cleanly

## Risks and Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| Inverted or out-of-bounds bounding box coordinates | High | Strict `@model_validator` in `NormalizedBox1000` enforcing `0 <= ymin < ymax <= 1000` |
| FHIR schema non-conformance for EHR ingestion | High | Conformance testing against HL7 FHIR R4 spec (LOINC + UCUM units) |
| Missing baseline CT in longitudinal comparison | Med | Explicit fallback detection and validation with helpful clinical guidance |
| High latency or unconstrained LLM responses | Med | Constrained decoding regex / schema parser with deterministic fallback responses |

