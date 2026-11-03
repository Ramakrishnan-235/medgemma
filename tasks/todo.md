# Todo List: MedGemma Clinical Imaging Intelligence Suite

## Task 1: Clinical Intelligence Schemas & Constrained Models
**Description:** Define all core Pydantic v2 schemas for the clinical suite in `apps/api/app/schemas/ct_clinical.py`. Includes `NormalizedBox1000` (with bounds validation), `LungRadsAssessment`, `CTRateMultiOrganLabels` (18 classes), `FreeFormRadiologyReport`, `LongitudinalComparisonReport`, `TargetedSliceVQARequest`, `TargetedSliceVQAResponse`, and `VisualGroundingAnnotation`.
**Acceptance criteria:**
- [x] Validates `[ymin, xmin, ymax, xmax]` bounding boxes within `0..1000` integer space and converts to `0.0..1.0` normalized floats.
- [x] Inverted bounding box coordinates raise `ValidationError`.
- [x] `CTRateMultiOrganLabels` provides helper `present_conditions(threshold)`.
**Verification:**
- [x] Tests pass: `.\.venv\Scripts\python.exe -m pytest tests/test_ct_clinical_schemas.py -v`
**Dependencies:** None
**Files touched:**
- `apps/api/app/schemas/ct_clinical.py`
- `tests/test_ct_clinical_schemas.py`
**Estimated scope:** Small (2 files)

---

## Checkpoint 1: Foundation Schemas
- [x] `.\.venv\Scripts\python.exe -m pytest tests/test_ct_clinical_schemas.py` passes

---

## Task 2: Free-Form Narrative Radiology & Longitudinal Comparison Engine
**Description:** Implement narrative Findings & Impression section generation from 3D CT volumes and longitudinal comparison (RECIST 1.1 axial diameter changes, volume delta, attenuation delta, interval days, and response classification).
**Acceptance criteria:**
- [x] `generate_narrative_radiology_report` outputs RSNA-formatted `technique`, `findings_markdown`, and `impression_markdown`.
- [x] `generate_longitudinal_comparison` calculates diameter change, volume change, interval days, and assigns RECIST category.
**Verification:**
- [x] Tests pass: `.\.venv\Scripts\python.exe -m pytest tests/test_ct_report_generator.py -v`
**Dependencies:** Task 1
**Files touched:**
- `apps/api/app/services/ct_report_generator.py`
- `tests/test_ct_report_generator.py`
**Estimated scope:** Small (2 files)

---

## Task 3: Constrained JSON Decoding & FHIR R4 Bundle Exporter
**Description:** Implement `build_fhir_r4_diagnostic_bundle` in `apps/api/app/services/fhir_exporter.py` creating an HL7 FHIR R4 transaction bundle with a `DiagnosticReport` (LOINC `24627-2`) referencing `Observation` resources with UCUM units (`mm`, `cm3`, `[HU]`) and Lung-RADS score.
**Acceptance criteria:**
- [x] Returns valid FHIR R4 `Bundle` with `type: "transaction"`.
- [x] DiagnosticReport correctly references each Observation via `urn:uuid:...` id.
- [x] Quantitative observations include standard UCUM units.
**Verification:**
- [x] Tests pass: `.\.venv\Scripts\python.exe -m pytest tests/test_fhir_exporter.py -v`
**Dependencies:** Task 1
**Files touched:**
- `apps/api/app/services/fhir_exporter.py`
- `tests/test_fhir_exporter.py`
**Estimated scope:** Small (2 files)

---

## Task 4: Diagnostic Classifications (Lung-RADS v2022 & CT-RATE 18 Multi-Organ Abnormality)
**Description:** Implement `evaluate_lung_rads_v2022` and `classify_ct_rate_abnormalities` in `apps/api/app/services/ct_classifiers.py`.
**Acceptance criteria:**
- [x] Evaluates solid/subsolid nodule size and assigns ACR Lung-RADS categories (`1`, `2`, `3`, `4A`, `4B`, `4X`) with malignancy probabilities.
- [x] Classifies the 18 CT-RATE condition labels with calibrated probability scores.
**Verification:**
- [x] Tests pass: `.\.venv\Scripts\python.exe -m pytest tests/test_ct_classifiers.py -v`
**Dependencies:** Task 1
**Files touched:**
- `apps/api/app/services/ct_classifiers.py`
- `tests/test_ct_classifiers.py`
**Estimated scope:** Small (2 files)

---

## Task 5: Interactive Visual Question Answering (Targeted Slice VQA)
**Description:** Implement `answer_targeted_slice_question` in `apps/api/app/services/targeted_slice_vqa.py` to answer questions about specific axial slices (1..160) and tissue windows (`lung`, `bone`, `soft_tissue`, `liver`, `mediastinum`).
**Acceptance criteria:**
- [x] Validates slice range and generates clinical markdown answer with confidence score and grounding box if applicable.
- [x] Handles tissue window specific inquiries (e.g. bone window fracture questions, soft tissue liver queries).
**Verification:**
- [x] Tests pass: `.\.venv\Scripts\python.exe -m pytest tests/test_targeted_slice_vqa.py -v`
**Dependencies:** Task 1
**Files touched:**
- `apps/api/app/services/targeted_slice_vqa.py`
- `tests/test_targeted_slice_vqa.py`
**Estimated scope:** Small (2 files)

---

## Task 6: Anatomical Bounding Box Visual Grounding & API Endpoints
**Description:** Implement `get_slice_grounding_annotations` in `apps/api/app/services/visual_grounding.py` and expose all 5 feature endpoints in `apps/api/app/api/v1/volumetric.py`.
**Acceptance criteria:**
- [x] Returns bounding boxes in `[ymin, xmin, ymax, xmax]` normalized coordinate space.
- [x] Mounts `/reports/free-form`, `/reports/longitudinal`, `/fhir/diagnostic-bundle`, `/classifications`, `/vqa`, and `/grounding` under `/api/v1/volumetric/`.
**Verification:**
- [x] Tests pass: `.\.venv\Scripts\python.exe -m pytest tests/test_visual_grounding.py -v`
**Dependencies:** Tasks 1-5
**Files touched:**
- `apps/api/app/services/visual_grounding.py`
- `apps/api/app/api/v1/volumetric.py`
- `tests/test_visual_grounding.py`
**Estimated scope:** Medium (3 files)

---

## Checkpoint 2: All Backend Services & Endpoints Complete
- [x] All unit tests for Tasks 1-6 pass

---

## Task 7: Frontend Visual Grounding Overlay & Interactive VQA Viewport
**Description:** Build SVG bounding box overlay in `apps/web/src/components/volumetric/VisualGroundingOverlay.tsx`, wire coordinate parsing in `api.ts`, mount in `AxialViewport.tsx`, and add interactive VQA panel in `VolumetricSidebar.tsx`.
**Acceptance criteria:**
- [x] `parseBoundingBox1000` correctly converts integer 1000-based boxes to viewport pixels.
- [x] Bounding boxes render with high-contrast borders and labels over the axial CT canvas.
- [x] VQA input allows typing questions, sending to `/api/v1/volumetric/vqa`, and viewing answers.
**Verification:**
- [x] Tests pass: `cd apps/web && bun test src/components/volumetric/volumetric.test.ts`
- [x] Typecheck pass: `cd apps/web && bun run type-check`
**Dependencies:** Task 6
**Files touched:**
- `apps/web/src/components/volumetric/VisualGroundingOverlay.tsx`
- `apps/web/src/components/volumetric/AxialViewport.tsx`
- `apps/web/src/components/volumetric/VolumetricSidebar.tsx`
- `apps/web/src/components/volumetric/api.ts`
- `apps/web/src/components/volumetric/types.ts`
- `apps/web/src/components/volumetric/volumetric.test.ts`
**Estimated scope:** Medium (5 files)

---

## Task 8: End-to-End Volumetric API & Clinical Workspace Integration Verification
**Description:** Add comprehensive API integration tests in `tests/test_volumetric_api.py` testing all 5 endpoints end-to-end, and verify zero regressions across the entire MedGemma test suite.
**Acceptance criteria:**
- [x] All 5 new endpoints return valid responses with expected status codes and payloads.
- [x] Complete existing test suite (`tests/`) passes without regression (130 tests passing).
**Verification:**
- [x] Tests pass: `.\.venv\Scripts\python.exe -m pytest tests/test_volumetric_api.py -v`
- [x] Full suite passes: `.\.venv\Scripts\python.exe -m pytest tests -q`
**Dependencies:** Tasks 1-7
**Files touched:**
- `tests/test_volumetric_api.py`
- `app/main.py`
**Estimated scope:** Small (2 files)

---

## Checkpoint 3: Complete Suite Pass
- [x] All 130 tests pass
- [x] Frontend tests & typechecks pass
