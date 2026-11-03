# MedGemma Clinical Imaging Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the complete 5-part MedGemma clinical imaging intelligence suite: (1) Free-Form Findings/Impression & Longitudinal Comparison Reports, (2) Constrained JSON & FHIR R4 Diagnostic Bundles, (3) Lung-RADS v2022 & CT-RATE 18 Multi-Organ Abnormality Classifications, (4) Targeted Slice & Window Visual Question Answering (VQA), and (5) Anatomical Bounding Box Visual Grounding (`[ymin, xmin, ymax, xmax]`) with frontend Cornerstone.js/Canvas overlays.

**Architecture:** A layered clinical inference architecture extending FastAPI backend services and Next.js/Cornerstone frontend. Synthetic and real 3D CT axial volumes (160+ slices) feed into specialized prompt engines and classifier heads via the MedGemma vLLM service. Outputs are validated through strict Pydantic schemas, transformed into FHIR R4 observation bundles, and projected onto interactive slice viewports with normalized SVG/Canvas bounding box overlays.

**Tech Stack:** Python 3.12+, FastAPI, Pydantic v2, NumPy, SimpleITK/Pillow, HL7 FHIR R4 JSON standard, Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Cornerstone.js / HTML5 2D Canvas.

**Spec:** User feature specification covering Free-Form Radiology Reports, Structured JSON/FHIR, Diagnostic Classifications (Lung-RADS & CT-RATE), Slice VQA, and Visual Grounding bounding boxes.

## Global Constraints

- Backend endpoints must mount under `/api/v1/volumetric/*` and `/v1/volumetric/*` while maintaining backwards compatibility with existing `/api/v1/volumetric/analyze-volume`.
- All spatial coordinates must normalize to `[0.0, 1.0]` (or `0..1000` integer space) with explicit schema validation (`0.0 <= ymin < ymax <= 1.0`, `0.0 <= xmin < xmax <= 1.0`).
- FHIR outputs must strictly follow HL7 FHIR R4 `DiagnosticReport` and `Observation` resource standards using LOINC (`24627-2`, `79040-2`, `24606-6`) and UCUM units (`mm`, `cm3`, `[HU]`).
- The 18 CT-RATE multi-organ abnormality classes must adhere to the standard benchmark taxonomy.
- Frontend overlays must smoothly update when scrubbing axial slices (1 to 160) without re-rendering unnecessary DOM nodes.
- Python tests in `tests/` must execute without requiring external PostgreSQL, Redis, or GPU hardware by using deterministic fixtures and mocks.

## Review Focus

1. **Out-of-bounds slice index in VQA or Visual Grounding**: Requesting slice 0 or slice 161 on a 160-slice volume must return HTTP 422 validation error instead of index out of range.
2. **Degenerate or inverted bounding box coordinates**: Coordinates where `ymax <= ymin` or `xmax <= xmin` or containing NaN/infinity must be caught and rejected at schema validation.
3. **Missing historical comparison scan in Longitudinal Reporting**: Requesting longitudinal comparison without a baseline study must return a clean clinical warning or baseline initialization response rather than crashing with missing key errors.
4. **Invalid or malformed JSON from LLM constrained decoding**: LLM outputs with markdown codeblocks or unescaped characters must be cleanly sanitized and validated against the Pydantic schema with deterministic fallbacks.
5. **FHIR bundle reference integrity**: Every `Observation` inside the FHIR R4 Bundle must have a valid relative `id` and be correctly referenced under `DiagnosticReport.result`.

---

### Task 1: Clinical Intelligence Schemas & Constrained Models

**Files:**
- Create: `apps/api/app/schemas/ct_clinical.py`
- Test: `tests/test_ct_clinical_schemas.py`

**Interfaces:**
- Consumes: `pydantic.BaseModel`, `pydantic.Field`, `pydantic.model_validator`
- Produces: `NormalizedBox1000`, `LungRadsAssessment`, `CTRateMultiOrganLabels`, `FreeFormRadiologyReport`, `LongitudinalComparisonReport`, `TargetedSliceVQARequest`, `TargetedSliceVQAResponse`, `FHIRDiagnosticBundleResponse`, `VisualGroundingAnnotation`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_ct_clinical_schemas.py
import pytest
from pydantic import ValidationError
import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "api")))
from app.schemas.ct_clinical import (
    NormalizedBox1000,
    LungRadsAssessment,
    CTRateMultiOrganLabels,
    FreeFormRadiologyReport,
    LongitudinalComparisonReport,
    TargetedSliceVQARequest,
    TargetedSliceVQAResponse,
    VisualGroundingAnnotation,
)

def test_normalized_box_validation():
    # Valid box [ymin, xmin, ymax, xmax] in 0..1000
    box = NormalizedBox1000(ymin=120, xmin=150, ymax=450, xmax=600)
    assert box.ymin == 120
    assert box.to_normalized_float() == (0.12, 0.15, 0.45, 0.6)

    # Inverted box should fail validation
    with pytest.raises(ValidationError):
        NormalizedBox1000(ymin=500, xmin=100, ymax=400, xmax=300)

def test_lung_rads_assessment_schema():
    assessment = LungRadsAssessment(
        category="4A",
        score_description="Suspicious nodule (8 to <15mm solid)",
        malignancy_probability=0.12,
        recommended_management="3-month low-dose CT or PET-CT",
        primary_nodule_size_mm=9.5,
    )
    assert assessment.category == "4A"
    assert assessment.malignancy_probability == 0.12

def test_ct_rate_18_classes_schema():
    labels = CTRateMultiOrganLabels(
        nodule=0.94,
        consolidation=0.08,
        pleural_effusion=0.02,
        medical_device=0.0,
    )
    assert labels.nodule == 0.94
    assert len(labels.present_conditions(threshold=0.5)) == 1
    assert "nodule" in labels.present_conditions(threshold=0.5)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.\.venv\Scripts\python.exe -m pytest tests/test_ct_clinical_schemas.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.schemas.ct_clinical'`

- [ ] **Step 3: Implement `apps/api/app/schemas/ct_clinical.py`**

Define Pydantic v2 data models for `NormalizedBox1000` (validating `0 <= ymin < ymax <= 1000` and `0 <= xmin < xmax <= 1000`), `LungRadsAssessment` (categories `1`, `2`, `3`, `4A`, `4B`, `4X`), `CTRateMultiOrganLabels` (18 standard CT-RATE abnormality classes: `medical_device`, `nodule`, `emphysema`, `fibrosis`, `consolidation`, `atelectasis`, `bronchiectasis`, `pleural_effusion`, `pleural_thickening`, `pericardial_effusion`, `lymphadenopathy`, `cardiomegaly`, `aortic_calcification`, `coronary_calcification`, `hiatal_hernia`, `mass`, `fracture`, `normal`), `FreeFormRadiologyReport`, `LongitudinalComparisonReport`, `TargetedSliceVQARequest`, and `VisualGroundingAnnotation`.

- [ ] **Step 4: Run test to verify it passes**

Run: `.\.venv\Scripts\python.exe -m pytest tests/test_ct_clinical_schemas.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/schemas/ct_clinical.py tests/test_ct_clinical_schemas.py
git commit -m "feat(schemas): add Pydantic schemas for clinical CT intelligence suite"
```

---

### Task 2: Free-Form Narrative Radiology & Longitudinal Comparison Engine

**Files:**
- Create: `apps/api/app/services/ct_report_generator.py`
- Modify: `apps/api/app/api/v1/volumetric.py:200-240`
- Test: `tests/test_ct_report_generator.py`

**Interfaces:**
- Consumes: `app.services.ct_volume_pipeline`, `app.schemas.ct_clinical.FreeFormRadiologyReport`, `app.schemas.ct_clinical.LongitudinalComparisonReport`
- Produces: `generate_narrative_radiology_report()`, `generate_longitudinal_comparison()`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_ct_report_generator.py
import pytest
import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "api")))
from app.services.ct_report_generator import (
    generate_narrative_radiology_report,
    generate_longitudinal_comparison,
)

def test_generate_narrative_radiology_report():
    report = generate_narrative_radiology_report(
        case_id="CASE-2026-0894",
        lesion_data={
            "peak_slice": 64,
            "dimensions_str": "14.2 × 11.8 × 12.0 mm",
            "volume_cm3": 1.05,
            "mean_hu": 42.0,
            "anatomical_location": "Liver dome / segment VII",
        },
        telemetry={"matrix": "512×512", "slice_thickness_mm": 1.25, "kernel": "B30f soft"},
    )
    assert report.technique != ""
    assert "FINDINGS" in report.findings_markdown
    assert "IMPRESSION" in report.impression_markdown
    assert "segment VII" in report.findings_markdown.lower() or "segment vii" in report.impression_markdown.lower()

def test_generate_longitudinal_comparison():
    prior_scan = {
        "study_date": "2026-01-15",
        "lesion_longest_diameter_mm": 11.2,
        "volume_cm3": 0.72,
        "mean_hu": 38.0,
    }
    current_scan = {
        "study_date": "2026-04-20",
        "lesion_longest_diameter_mm": 14.2,
        "volume_cm3": 1.05,
        "mean_hu": 42.0,
    }
    comparison = generate_longitudinal_comparison(prior_scan, current_scan)
    assert comparison.diameter_change_mm == pytest.approx(3.0, rel=1e-2)
    assert comparison.volume_change_cm3 == pytest.approx(0.33, rel=1e-2)
    assert comparison.interval_days == 95
    assert comparison.recist_category in ["Progressive Disease", "Stable Disease"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.\.venv\Scripts\python.exe -m pytest tests/test_ct_report_generator.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.services.ct_report_generator'`

- [ ] **Step 3: Implement `apps/api/app/services/ct_report_generator.py`**

Implement:
- `generate_narrative_radiology_report(...) -> FreeFormRadiologyReport`:
  Builds multi-organ observations (`Lungs/Pleura`, `Mediastinum/Heart`, `Abdomen/Pelvis`, `Musculoskeletal`), structured findings text, and numbered clinical impressions.
- `generate_longitudinal_comparison(prior_study: dict, current_study: dict) -> LongitudinalComparisonReport`:
  Computes interval duration in days, RECIST 1.1 percentage change in longest axial diameter, volume delta ($\text{cm}^3$), attenuation change ($\Delta \text{HU}$), and categorizes into `Progressive Disease` ($\ge +20\%$), `Partial Response` ($\le -30\%$), or `Stable Disease`.

- [ ] **Step 4: Run test to verify it passes**

Run: `.\.venv\Scripts\python.exe -m pytest tests/test_ct_report_generator.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/services/ct_report_generator.py tests/test_ct_report_generator.py
git commit -m "feat(reporting): implement free-form radiology report and longitudinal RECIST comparison"
```

---

### Task 3: Constrained JSON Decoding & FHIR R4 Bundle Exporter

**Files:**
- Create: `apps/api/app/services/fhir_exporter.py`
- Modify: `apps/api/app/services/generation.py`
- Test: `tests/test_fhir_exporter.py`

**Interfaces:**
- Consumes: `app.schemas.ct_clinical`, `pydantic`
- Produces: `build_fhir_r4_diagnostic_bundle(patient_id, case_id, study_findings, measurements)`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_fhir_exporter.py
import pytest
import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "api")))
from app.services.fhir_exporter import build_fhir_r4_diagnostic_bundle

def test_build_fhir_r4_diagnostic_bundle():
    bundle = build_fhir_r4_diagnostic_bundle(
        patient_id="PAT-9842",
        case_id="CASE-2026-0894",
        modality="CT",
        narrative_impression="Focal hypodense nodular lesion in liver segment VII.",
        measurements=[
            {"code": "24606-6", "display": "Nodule Long Axis Diameter", "value": 14.2, "unit": "mm"},
            {"code": "volume", "display": "3D Lesion Volume", "value": 1.05, "unit": "cm3"},
            {"code": "attenuation", "display": "Mean CT Attenuation", "value": 42.0, "unit": "[HU]"},
        ],
        lung_rads_score="4A",
    )
    assert bundle["resourceType"] == "Bundle"
    assert bundle["type"] == "transaction"
    entries = bundle["entry"]
    assert len(entries) >= 4  # DiagnosticReport + 3 Observations + optional Lung-RADS

    report_entry = next(e["resource"] for e in entries if e["resource"]["resourceType"] == "DiagnosticReport")
    assert report_entry["code"]["coding"][0]["code"] == "24627-2"  # LOINC Chest CT
    assert len(report_entry["result"]) >= 3
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.\.venv\Scripts\python.exe -m pytest tests/test_fhir_exporter.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.services.fhir_exporter'`

- [ ] **Step 3: Implement `apps/api/app/services/fhir_exporter.py`**

Implement `build_fhir_r4_diagnostic_bundle(...) -> dict[str, Any]`:
Constructs valid HL7 FHIR Release 4 specification transaction bundle:
- `DiagnosticReport` resource with LOINC `24627-2` ("Diagnostic radiology study"), status `"preliminary"` or `"final"`, clinical conclusion markdown.
- `Observation` resources for physical measurements using UCUM codes (`mm`, `cm3`, `[HU]`).
- `Observation` for Lung-RADS classification using LOINC `79040-2` ("Lung-RADS category").
- Links observation entries into `DiagnosticReport.result` using internal UUID reference URLs (`urn:uuid:...`).

- [ ] **Step 4: Run test to verify it passes**

Run: `.\.venv\Scripts\python.exe -m pytest tests/test_fhir_exporter.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/services/fhir_exporter.py tests/test_fhir_exporter.py
git commit -m "feat(fhir): implement FHIR R4 DiagnosticReport and Observation transaction bundle generator"
```

---

### Task 4: Diagnostic Classifications: Lung-RADS v2022 & CT-RATE 18 Multi-Organ Abnormality Engine

**Files:**
- Create: `apps/api/app/services/ct_classifiers.py`
- Modify: `apps/api/app/api/v1/volumetric.py`
- Test: `tests/test_ct_classifiers.py`

**Interfaces:**
- Consumes: `app.schemas.ct_clinical.LungRadsAssessment`, `app.schemas.ct_clinical.CTRateMultiOrganLabels`
- Produces: `evaluate_lung_rads_v2022(...)`, `classify_ct_rate_abnormalities(...)`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_ct_classifiers.py
import pytest
import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "api")))
from app.services.ct_classifiers import (
    evaluate_lung_rads_v2022,
    classify_ct_rate_abnormalities,
)

def test_evaluate_lung_rads_v2022():
    # Solid nodule 9.5mm -> 4A
    res_4a = evaluate_lung_rads_v2022(diameter_mm=9.5, nodule_type="solid", is_new=False)
    assert res_4a.category == "4A"
    assert res_4a.malignancy_probability >= 0.05 and res_4a.malignancy_probability <= 0.15

    # Solid nodule 16.0mm -> 4B
    res_4b = evaluate_lung_rads_v2022(diameter_mm=16.0, nodule_type="solid", is_new=False)
    assert res_4b.category == "4B"

    # Solid nodule 4.5mm -> Category 2
    res_2 = evaluate_lung_rads_v2022(diameter_mm=4.5, nodule_type="solid", is_new=False)
    assert res_2.category == "2"

def test_classify_ct_rate_abnormalities():
    findings = classify_ct_rate_abnormalities(
        primary_roi_label="nodule",
        mean_hu=42.0,
        volume_cm3=1.05,
    )
    assert findings.nodule > 0.85
    assert findings.normal < 0.15
    assert 0.0 <= findings.pleural_effusion <= 1.0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.\.venv\Scripts\python.exe -m pytest tests/test_ct_classifiers.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.services.ct_classifiers'`

- [ ] **Step 3: Implement `apps/api/app/services/ct_classifiers.py`**

Implement:
- `evaluate_lung_rads_v2022(diameter_mm: float, nodule_type: str = "solid", is_new: bool = False, has_additional_suspicion: bool = False) -> LungRadsAssessment`:
  Implements the full ACR Lung-RADS v2022 criteria decision matrix (Category 1 through 4X), calculates logit probabilities for malignancy risks, and returns clinical management recommendations.
- `classify_ct_rate_abnormalities(primary_roi_label: str, mean_hu: float, volume_cm3: float, telemetry: dict | None = None) -> CTRateMultiOrganLabels`:
  Evaluates 18 CT-RATE condition labels, returning probability scores calibrated from ROI volumetric features and study context.

- [ ] **Step 4: Run test to verify it passes**

Run: `.\.venv\Scripts\python.exe -m pytest tests/test_ct_classifiers.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/services/ct_classifiers.py tests/test_ct_classifiers.py
git commit -m "feat(classifiers): implement Lung-RADS v2022 and CT-RATE 18 multi-organ abnormality classification"
```

---

### Task 5: Interactive Visual Question Answering (Targeted Slice VQA)

**Files:**
- Create: `apps/api/app/services/targeted_slice_vqa.py`
- Modify: `apps/api/app/api/v1/volumetric.py`
- Test: `tests/test_targeted_slice_vqa.py`

**Interfaces:**
- Consumes: `app.schemas.ct_clinical.TargetedSliceVQARequest`, `app.schemas.ct_clinical.TargetedSliceVQAResponse`
- Produces: `answer_targeted_slice_question(request: TargetedSliceVQARequest) -> TargetedSliceVQAResponse`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_targeted_slice_vqa.py
import pytest
import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "api")))
from app.schemas.ct_clinical import TargetedSliceVQARequest
from app.services.targeted_slice_vqa import answer_targeted_slice_question

def test_answer_targeted_slice_lesion_question():
    req = TargetedSliceVQARequest(
        case_id="CASE-2026-0894",
        slice_index=64,
        tissue_window="soft_tissue",
        question="Describe the focal lesion in the liver dome on this slice.",
    )
    ans = answer_targeted_slice_question(req)
    assert ans.slice_index == 64
    assert ans.confidence_score > 0.8
    assert "segment vii" in ans.answer_markdown.lower() or "hypodense" in ans.answer_markdown.lower()
    assert ans.grounded_box is not None
    assert ans.grounded_box.ymin > 0

def test_answer_targeted_slice_fracture_question():
    req = TargetedSliceVQARequest(
        case_id="CASE-2026-0894",
        slice_index=34,
        tissue_window="bone",
        question="Is there a fracture on slice 34?",
    )
    ans = answer_targeted_slice_question(req)
    assert ans.slice_index == 34
    assert "no acute fracture" in ans.answer_markdown.lower() or "intact" in ans.answer_markdown.lower()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.\.venv\Scripts\python.exe -m pytest tests/test_targeted_slice_vqa.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.services.targeted_slice_vqa'`

- [ ] **Step 3: Implement `apps/api/app/services/targeted_slice_vqa.py`**

Implement `answer_targeted_slice_question(request: TargetedSliceVQARequest) -> TargetedSliceVQAResponse`:
- Checks slice range (1..160) and tissue window presets (`soft_tissue`, `lung`, `bone`, `liver`, `mediastinum`).
- Contextualizes HU values and anatomical contours at the given slice.
- Generates focused clinical answers with anatomical citations and optional `NormalizedBox1000` bounding box citations.

- [ ] **Step 4: Run test to verify it passes**

Run: `.\.venv\Scripts\python.exe -m pytest tests/test_targeted_slice_vqa.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/services/targeted_slice_vqa.py tests/test_targeted_slice_vqa.py
git commit -m "feat(vqa): implement targeted slice and window visual question answering service"
```

---

### Task 6: Anatomical Bounding Box Visual Grounding & API Endpoints

**Files:**
- Create: `apps/api/app/services/visual_grounding.py`
- Modify: `apps/api/app/api/v1/volumetric.py`
- Test: `tests/test_visual_grounding.py`

**Interfaces:**
- Consumes: `app.schemas.ct_clinical.VisualGroundingAnnotation`, `app.schemas.ct_clinical.NormalizedBox1000`
- Produces: `get_slice_grounding_annotations(case_id, slice_index, modality) -> list[VisualGroundingAnnotation]`
- Endpoints added:
  - `POST /api/v1/volumetric/reports/free-form`
  - `POST /api/v1/volumetric/reports/longitudinal`
  - `POST /api/v1/volumetric/fhir/diagnostic-bundle`
  - `POST /api/v1/volumetric/classifications`
  - `POST /api/v1/volumetric/vqa`
  - `GET /api/v1/volumetric/grounding`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_visual_grounding.py
import pytest
import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "api")))
from app.services.visual_grounding import get_slice_grounding_annotations

def test_get_slice_grounding_lesion_slice():
    annotations = get_slice_grounding_annotations("CASE-2026-0894", slice_index=64)
    assert len(annotations) >= 1
    lesion = annotations[0]
    assert lesion.label == "Segment VII hypodense lesion"
    assert lesion.box_1000.ymin < lesion.box_1000.ymax
    assert lesion.box_1000.xmin < lesion.box_1000.xmax
    # Coordinates must normalize to float [0..1]
    norm_y0, norm_x0, norm_y1, norm_x1 = lesion.box_1000.to_normalized_float()
    assert 0.0 <= norm_y0 < norm_y1 <= 1.0

def test_get_slice_grounding_distant_slice():
    # Slice far from lesion should return empty or anatomical reference structures
    annotations = get_slice_grounding_annotations("CASE-2026-0894", slice_index=150)
    lesion_boxes = [a for a in annotations if "lesion" in a.label.lower()]
    assert len(lesion_boxes) == 0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.\.venv\Scripts\python.exe -m pytest tests/test_visual_grounding.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.services.visual_grounding'`

- [ ] **Step 3: Implement `apps/api/app/services/visual_grounding.py` and mount routes in `apps/api/app/api/v1/volumetric.py`**

- Implement `get_slice_grounding_annotations(...) -> list[VisualGroundingAnnotation]` returning string-formatted spatial `[ymin, xmin, ymax, xmax]` normalized coordinates and label tags.
- Wire all new endpoints into `apps/api/app/api/v1/volumetric.py` under the router.

- [ ] **Step 4: Run test to verify it passes**

Run: `.\.venv\Scripts\python.exe -m pytest tests/test_visual_grounding.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/services/visual_grounding.py apps/api/app/api/v1/volumetric.py tests/test_visual_grounding.py
git commit -m "feat(grounding): implement anatomical bounding box visual grounding and clinical API endpoints"
```

---

### Task 7: Frontend Visual Grounding Overlay & Interactive VQA Viewport Integration

**Files:**
- Create: `apps/web/src/components/volumetric/VisualGroundingOverlay.tsx`
- Modify: `apps/web/src/components/volumetric/AxialViewport.tsx`
- Modify: `apps/web/src/components/volumetric/VolumetricSidebar.tsx`
- Modify: `apps/web/src/components/volumetric/api.ts`
- Modify: `apps/web/src/components/volumetric/types.ts`
- Test: `apps/web/src/components/volumetric/volumetric.test.ts`

**Interfaces:**
- Consumes: `VisualGroundingAnnotation` from API client, current `slice` and canvas dimensions
- Produces: Visual bounding box SVG overlay on top of DICOM canvas, interactive targeted slice VQA prompt & answer drawer

- [ ] **Step 1: Write the failing frontend test**

```typescript
// apps/web/src/components/volumetric/volumetric.test.ts (append test)
import { describe, it, expect } from "bun:test";
import { parseBoundingBox1000 } from "./api";

describe("Visual Grounding Coordinates Parser", () => {
  it("converts [ymin, xmin, ymax, xmax] 1000-based boxes to canvas pixel coordinates", () => {
    const box1000 = { ymin: 200, xmin: 300, ymax: 600, xmax: 800 };
    const canvasWidth = 500;
    const canvasHeight = 400;

    const px = parseBoundingBox1000(box1000, canvasWidth, canvasHeight);
    expect(px.left).toBe(150); // 300/1000 * 500
    expect(px.top).toBe(80);   // 200/1000 * 400
    expect(px.width).toBe(250); // (800-300)/1000 * 500
    expect(px.height).toBe(160); // (600-200)/1000 * 400
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && bun test src/components/volumetric/volumetric.test.ts`
Expected: FAIL with `parseBoundingBox1000 is not a function`

- [ ] **Step 3: Implement `VisualGroundingOverlay.tsx`, coordinate conversions, and VQA UI controls**

- Implement `parseBoundingBox1000(box, width, height)` in `api.ts`.
- Create `VisualGroundingOverlay.tsx` rendering SVG rectangle overlays with label chips and confidence badges.
- Mount `VisualGroundingOverlay` inside `AxialViewport.tsx`.
- Add interactive VQA question input drawer in `VolumetricSidebar.tsx` with instant Q&A responses and slice jump buttons.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && bun test src/components/volumetric/volumetric.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/volumetric/ apps/web/src/components/volumetric/volumetric.test.ts
git commit -m "feat(web): render visual bounding box overlays and add interactive slice VQA UI"
```

---

### Task 8: End-to-End Volumetric API & Clinical Workspace Integration Verification

**Files:**
- Modify: `tests/test_volumetric_api.py`
- Modify: `app/main.py`
- Test: `tests/test_volumetric_api.py`

**Interfaces:**
- Consumes: Complete clinical intelligence API surface
- Produces: 100% verified integration test suite across all 5 features

- [ ] **Step 1: Write integration tests covering all 5 features**

```python
# In tests/test_volumetric_api.py
def test_free_form_radiology_report_endpoint(self):
    resp = self.client.post("/api/v1/volumetric/reports/free-form?case_id=CASE-2026-0894")
    self.assertEqual(resp.status_code, 200)
    data = resp.json()
    self.assertIn("FINDINGS", data["findings_markdown"])
    self.assertIn("IMPRESSION", data["impression_markdown"])

def test_longitudinal_comparison_endpoint(self):
    resp = self.client.post("/api/v1/volumetric/reports/longitudinal?case_id=CASE-2026-0894")
    self.assertEqual(resp.status_code, 200)
    data = resp.json()
    self.assertIn("recist_category", data)
    self.assertGreater(data["interval_days"], 0)

def test_fhir_diagnostic_bundle_endpoint(self):
    resp = self.client.post("/api/v1/volumetric/fhir/diagnostic-bundle?case_id=CASE-2026-0894")
    self.assertEqual(resp.status_code, 200)
    data = resp.json()
    self.assertEqual(data["resourceType"], "Bundle")
    self.assertEqual(data["type"], "transaction")

def test_diagnostic_classifications_endpoint(self):
    resp = self.client.post("/api/v1/volumetric/classifications?case_id=CASE-2026-0894")
    self.assertEqual(resp.status_code, 200)
    data = resp.json()
    self.assertIn("lung_rads", data)
    self.assertIn("ct_rate_abnormalities", data)
    self.assertEqual(len(data["ct_rate_abnormalities"]), 18)

def test_targeted_slice_vqa_endpoint(self):
    payload = {
        "case_id": "CASE-2026-0894",
        "slice_index": 64,
        "tissue_window": "soft_tissue",
        "question": "Is there an abnormality on slice 64?",
    }
    resp = self.client.post("/api/v1/volumetric/vqa", json=payload)
    self.assertEqual(resp.status_code, 200)
    data = resp.json()
    self.assertEqual(data["slice_index"], 64)
    self.assertIn("answer_markdown", data)

def test_slice_visual_grounding_endpoint(self):
    resp = self.client.get("/api/v1/volumetric/grounding?case_id=CASE-2026-0894&slice_index=64")
    self.assertEqual(resp.status_code, 200)
    data = resp.json()
    self.assertTrue(len(data) >= 1)
    self.assertIn("box_1000", data[0])
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.\.venv\Scripts\python.exe -m pytest tests/test_volumetric_api.py -v`
Expected: FAIL until all endpoints are mounted and verified in `app/main.py` and `volumetric.py`.

- [ ] **Step 3: Update `app/main.py` and route attachments if necessary to pass all checks**

Verify and ensure root app mounts the updated volumetric router routes under `/api/v1/volumetric/*`.

- [ ] **Step 4: Run test to verify it passes**

Run: `.\.venv\Scripts\python.exe -m pytest tests/test_volumetric_api.py -v`
Expected: PASS (all 10+ volumetric tests pass)

- [ ] **Step 5: Run full test suite to guarantee zero regressions**

Run: `.\.venv\Scripts\python.exe -m pytest tests -q`
Expected: 110+ passed, 0 failures

- [ ] **Step 6: Commit**

```bash
git add app/main.py tests/test_volumetric_api.py
git commit -m "feat(integration): complete end-to-end integration and test validation for clinical intelligence suite"
```

