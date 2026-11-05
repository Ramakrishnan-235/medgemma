# Direct MedGemma 1.5 Local Inference Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bridge uploaded CT DICOM slices directly to the local `google/medgemma-1.5-4b-it` model on NVIDIA CUDA to generate real, non-mock bounding boxes and clinical assessments, replacing the instant client-side heuristic.

**Architecture:** A lightweight FastAPI inference endpoint (`POST /api/v1/ct/infer-slice`) loads the local 4-bit NF4 MedGemma model weights (using `transformers` + `bitsandbytes` with CUDA placement), runs vision-language nodule detection and localization on the uploaded slice, extracts normalized coordinates `[ymin, xmin, ymax, xmax]`, and returns real detections to the Next.js RadStudio viewport with live inference progress indicators.

**Tech Stack:** PyTorch 2.14.1 (CUDA 12.6), HuggingFace Transformers, BitsAndBytes 4-bit NF4, FastAPI, React 19, Next.js 16.4.3, Canvas 2D.

**Spec:** Local MedGemma 1.5 4B Vision-Language Nodule Detection & Grounding Contract.

## Global Constraints

- Must run on local hardware with NVIDIA GeForce RTX 2050 (4.0 GiB VRAM) without out-of-memory errors.
- Bounding box coordinates must be normalized to `[0, 1000]` for consistent spatial mapping to viewport canvas dimensions.
- Preserve physical mm scaling by multiplying normalized box width and height by DICOM `PixelSpacing`.
- Never block UI thread; provide asynchronous execution and visual feedback (`isInferring`).
- Maintain fallback compatibility when running in test environments without GPU hardware.

## Review Focus

- Image format: Slice transmitted as base64 PNG with 3-channel HU or calibrated grayscale.
- Coordinate accuracy: Model `<loc0...>` or `[ymin, xmin, ymax, xmax]` tokens correctly parsed into integers 0-1000.
- Out of bounds protection: Box coordinates clamped to `[0, 1000]` to prevent canvas clipping.
- VRAM management: Clean memory cleanup and torch garbage collection after generation.
- Client state consistency: `isInferring` correctly toggles from true to false upon completion or error.

---

### Task 1: Local MedGemma 1.5 Inference Service & Parser

**Files:**
- Create: `apps/api/app/services/local_medgemma.py`
- Test: `tests/test_local_medgemma.py`

- [ ] Step 1: Write failing test in `tests/test_local_medgemma.py` testing bounding box token extraction, coordinate normalization, and inference fallback.
- [ ] Step 2: Implement `apps/api/app/services/local_medgemma.py` with `parse_medgemma_location_tokens`, `format_detection_prompt`, and `MedGemmaLocalInferenceEngine` supporting local 4-bit NF4 weights and graceful testing mock.
- [ ] Step 3: Run `.\.venv\Scripts\python.exe -m pytest tests/test_local_medgemma.py -v` to ensure tests pass.
- [ ] Step 4: Commit changes.

### Task 2: Mount `POST /api/v1/ct/infer-slice` Endpoint

**Files:**
- Modify: `apps/api/app/api/v1/volumetric.py`
- Test: `tests/test_infer_slice_api.py`

- [ ] Step 1: Write test in `tests/test_infer_slice_api.py` verifying `POST /api/v1/ct/infer-slice` with base64 PNG input and coordinate output.
- [ ] Step 2: In `apps/api/app/api/v1/volumetric.py`, add `SliceInferenceRequest` model and mount `POST /api/v1/ct/infer-slice` routing to `MedGemmaLocalInferenceEngine`.
- [ ] Step 3: Run `.\.venv\Scripts\python.exe -m pytest tests/test_infer_slice_api.py -v` to verify endpoint response.
- [ ] Step 4: Commit changes.

### Task 3: Frontend API & Slice Extraction Hook

**Files:**
- Modify: `apps/web/src/components/volumetric/api.ts`
- Modify: `apps/web/src/components/radstudio/use-radstudio-state.ts`
- Modify: `apps/web/src/components/radstudio/types.ts`

- [ ] Step 1: In `apps/web/src/components/volumetric/api.ts`, add `inferSliceWithMedGemma` sending base64 PNG slice to `POST /api/v1/ct/infer-slice`.
- [ ] Step 2: In `apps/web/src/components/radstudio/types.ts`, add `isInferring?: boolean;` and `inferenceStage?: string;` to state types.
- [ ] Step 3: In `apps/web/src/components/radstudio/use-radstudio-state.ts`, update `handleDicomUploaded`:
  - Show initial scan instantly without hardcoded boxes.
  - Set `isInferring = true`.
  - Extract active slice pixels to PNG data URI and call `inferSliceWithMedGemma`.
  - On response, populate `box01` with model-generated coordinates and update `assessment` and `report`.
- [ ] Step 4: Run `bun test apps/web/` and `bun run --cwd apps/web type-check` to verify clean build.
- [ ] Step 5: Commit changes.

### Task 4: Viewport Visual Inference Scanner & Grounding Overlay

**Files:**
- Modify: `apps/web/src/components/radstudio/CtViewport.tsx`

- [ ] Step 1: In `apps/web/src/components/radstudio/CtViewport.tsx`, add an active AI inference scanner bar with pulse animation when `isInferring` is active.
- [ ] Step 2: Ensure real bounding box appears with `MedGemma 1.5 4B` provenance badge when inference finishes.
- [ ] Step 3: Test viewport rendering in browser / test suite.
- [ ] Step 4: Commit changes.

### Task 5: End-to-End Regression & Verification

- [ ] Step 1: Run full backend pytest suite `.\.venv\Scripts\python.exe -m pytest tests/ -v`.
- [ ] Step 2: Run frontend bun tests `bun test apps/web/`.
- [ ] Step 3: Run frontend type-check `bun run --cwd apps/web type-check`.
- [ ] Step 4: Run frontend production build `bun run --cwd apps/web build`.
- [ ] Step 5: Verify live backend endpoint on `http://localhost:8000/api/v1/ct/infer-slice`.
