# Prefix-Cached Dual-Path DAG Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the upgraded Prefix-Cached Dual-Path DAG for `google/medgemma-1.5-4b-it` CT volume inference: DICOM de-ID with 3-channel radiologic HU windowing (Lung/Mediastinum/Bone), vLLM automatic prefix caching (APC) with XGrammar guided micro-schemas, parallel execution of Lung-RADS (Output B) and 2D/3D affine millimeter boxes (Output D), unconstrained grounded narrative report streaming (Output A), stateful sub-150ms TTFT interactive VQA streaming (Output C), and MONAI cubic-millimeter volumetric segmentation fallback.

**Architecture:** Decouples heavy 3D CT vision prefill (~16k–32k vision tokens across 64–126 slices) from downstream generation using vLLM Automatic Prefix Caching. Deterministic low-temperature structured micro-schemas (Outputs B & D) execute concurrently over the cached volume, unproject 2D normalized boxes through DICOM `PixelSpacing` affine transforms into physical millimeters, and ground an unconstrained streaming clinical report (Output A) and warm-cache multi-turn VQA session (Output C).

**Tech Stack:** Python 3.12+, FastAPI, OpenAI AsyncOpenAI client, vLLM 0.6+ (APC + XGrammar backend), Pydantic v2, SimpleITK / pydicom, NumPy, Pillow, gRPC (aio), MONAI / Vista3D integration hooks.

**Spec:** User architecture specification: "Upgraded Production Architecture (Prefix-Cached Dual-Path DAG)".

## Global Constraints

- Slices must be strictly sorted along the craniocaudal Z-axis (`ImagePositionPatient[2]`).
- 3-Channel radiologic HU windows: Red = Lung (W:1500, L:-600), Green = Mediastinum (W:350, L:50), Blue = Bone (W:1800, L:400), normalized to uint8 and resized to 896x896 (MedSigLIP 256 tokens/slice).
- All task-specific prompts for a given CT study must share an identical leading system instruction and ordered image array to guarantee a 100% vLLM prefix cache hit.
- 2D normalized bounding boxes `[ymin, xmin, ymax, xmax]` in integer `0..1000` space must map to physical millimeters using `PixelSpacing` and `original_shape`.
- Guided JSON decoding must use `repetition_penalty=1.05` and tight `max_tokens=512` to prevent vLLM trailing whitespace loops.
- All Python tests must execute cleanly without external PostgreSQL, Redis, or live GPU hardware by using mocks and deterministic synthetic fixtures.

## Review Focus

1. **Inverted or non-axial DICOM slice ordering**: Slices with inconsistent `ImageOrientationPatient` or non-monotonic Z coordinates must be validated and sorted craniocaudally.
2. **Missing DICOM spatial metadata**: Studies missing `PixelSpacing` or `SliceThickness` must safely fall back to standardized isotropic defaults (e.g. 0.7mm x 0.7mm, 1.25mm thickness) with a telemetry warning rather than raising key errors.
3. **vLLM Guided JSON Whitespace padding loop**: Trailing whitespace or infinite generation loops must be terminated by strict Pydantic parsing and repetition penalty enforcement.
4. **Physical dimension math accuracy**: Millimeter calculations for non-square matrices or non-uniform pixel spacing (`row_mm != col_mm`) must correctly scale height and width independently.
5. **VQA Session Cache eviction / isolation**: Multi-turn VQA sessions across distinct `study_id` instances must isolate message history and support graceful session cleanup.

---

### Task 1: 3-Channel Radiologic Windowing & DICOM Affine Preprocessor

**Files:**
- Create: `apps/api/app/services/preprocess_ct.py`
- Test: `tests/test_preprocess_ct.py`

**Interfaces:**
- Consumes: `pydicom.Dataset`, `numpy.ndarray`, `PIL.Image`
- Produces: `apply_hu_window(hu_slice, center, width) -> np.ndarray`, `process_ct_series_for_medgemma(dicom_dir, max_slices) -> (List[Image.Image], Dict)`, `process_raw_hu_volume_for_medgemma(volume_hu, spacing_xyz, max_slices) -> (List[Image.Image], Dict)`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_preprocess_ct.py
import numpy as np
import pytest
from PIL import Image
from app.services.preprocess_ct import (
    apply_hu_window,
    process_raw_hu_volume_for_medgemma,
)

def test_apply_hu_window():
    # Lung window: center=-600, width=1500 -> [-1350, 150]
    slice_data = np.array([-1500, -1350, -600, 150, 500], dtype=np.float32)
    windowed = apply_hu_window(slice_data, center=-600, width=1500)
    assert windowed.dtype == np.uint8
    assert windowed[0] == 0       # Clipped to lower
    assert windowed[1] == 0       # Lower boundary
    assert 126 <= windowed[2] <= 128  # Midpoint ~127
    assert windowed[3] == 255     # Upper boundary
    assert windowed[4] == 255     # Clipped to upper

def test_process_raw_hu_volume_for_medgemma():
    # Create synthetic volume 10 slices of 64x64
    vol = np.zeros((10, 64, 64), dtype=np.float32)
    # Put lung in slice 2, bone in slice 5
    vol[2, :, :] = -600.0
    vol[5, :, :] = 1000.0
    spacing = (0.75, 0.75, 1.5)

    images, meta = process_raw_hu_volume_for_medgemma(vol, spacing, max_slices=8)
    assert len(images) == 8
    assert all(img.size == (896, 896) for img in images)
    assert meta["pixel_spacing_mm"] == [0.75, 0.75]
    assert meta["original_shape"] == [64, 64]
    assert meta["slice_thickness_mm"] == 1.5
    assert len(meta["slice_z_mm"]) == 8
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.\.venv\Scripts\python.exe -m pytest tests/test_preprocess_ct.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.services.preprocess_ct'`

- [ ] **Step 3: Implement `apps/api/app/services/preprocess_ct.py`**

Implement `apply_hu_window`, `process_ct_series_for_medgemma` (with pydicom DICOM file reading, craniocaudal sorting by `ImagePositionPatient[2]`, uniform subsampling, 3-channel HU windowing: R=Lung, G=Mediastinum, B=Bone, resize to 896x896), and `process_raw_hu_volume_for_medgemma` for array/NIfTI inputs.

- [ ] **Step 4: Run test to verify it passes**

Run: `.\.venv\Scripts\python.exe -m pytest tests/test_preprocess_ct.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/services/preprocess_ct.py tests/test_preprocess_ct.py
git commit -m "feat(imaging): implement 3-channel HU windowing and DICOM affine preprocessor"
```

---

### Task 2: vLLM Production Configuration & Server Hardening

**Files:**
- Modify: `apps/gpu-service/vllm_server.py`
- Modify: `apps/gpu-service/Dockerfile.l4.vllm`
- Modify: `docker-compose.gpu-l4.yml`
- Test: `tests/test_vllm_server_config.py`

**Interfaces:**
- Consumes: vLLM `AsyncEngineArgs`, `SamplingParams`
- Produces: Server startup with `--enable-prefix-caching`, `--guided-decoding-backend xgrammar`, `--max-model-len 65536`, `--limit-mm-per-prompt image=128`, repetition penalty = 1.05

- [ ] **Step 1: Write the failing test**

```python
# tests/test_vllm_server_config.py
import pytest
from apps.gpu_service import vllm_server

def test_vllm_server_configuration_constants():
    assert vllm_server.MAX_IMAGES_PER_PROMPT >= 128
    assert vllm_server.MAX_MODEL_LEN >= 65536
    assert vllm_server.DEFAULT_REPETITION_PENALTY == 1.05
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.\.venv\Scripts\python.exe -m pytest tests/test_vllm_server_config.py -v`
Expected: FAIL due to `MAX_IMAGES_PER_PROMPT` = 4 and `MAX_MODEL_LEN` = 16384.

- [ ] **Step 3: Update `apps/gpu-service/vllm_server.py`, `Dockerfile.l4.vllm`, and `docker-compose.gpu-l4.yml`**

Update `MAX_IMAGES_PER_PROMPT` default to 128, `MAX_MODEL_LEN` to 65536, and `GPU_MEM_UTIL` to 0.90. In `AsyncEngineArgs`, set `guided_decoding_backend="xgrammar"`. In sampling parameters, include `repetition_penalty=1.05`.

- [ ] **Step 4: Run test to verify it passes**

Run: `.\.venv\Scripts\python.exe -m pytest tests/test_vllm_server_config.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/gpu-service/vllm_server.py apps/gpu-service/Dockerfile.l4.vllm docker-compose.gpu-l4.yml tests/test_vllm_server_config.py
git commit -m "feat(gpu): upgrade vLLM server to 65k context, 128 images, and xgrammar backend"
```

---

### Task 3: Dual-Path Inference Router with XGrammar Micro-Schemas & Physical Mm Converter

**Files:**
- Create: `apps/api/app/services/inference_router.py`
- Test: `tests/test_inference_router.py`

**Interfaces:**
- Consumes: `openai.AsyncOpenAI`, Pydantic models `LungRADSOutput`, `DetectionOutput`, `LesionBox3D`
- Produces: `box_to_physical_mm(box_2d, meta) -> dict`, `run_study_pipeline(base64_slices, spatial_meta, client) -> (dict, dict, AsyncGenerator)`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_inference_router.py
import pytest
from app.services.inference_router import (
    LungRADSOutput,
    DetectionOutput,
    LesionBox3D,
    box_to_physical_mm,
    run_study_pipeline,
)

def test_box_to_physical_mm():
    meta = {
        "original_shape": [512, 512],
        "pixel_spacing_mm": [0.68, 0.68],
        "slice_thickness_mm": 1.25,
        "slice_z_mm": [i * 1.25 for i in range(64)],
    }
    # Normalized box [ymin, xmin, ymax, xmax] = [200, 200, 300, 300] (delta=100)
    # height_mm = (100 / 1000) * 512 * 0.68 = 34.816 -> 34.82
    dims = box_to_physical_mm([200, 200, 300, 300], meta)
    assert dims["height_mm"] == pytest.approx(34.82, abs=0.05)
    assert dims["width_mm"] == pytest.approx(34.82, abs=0.05)
    assert dims["mean_diameter_mm"] == pytest.approx(34.82, abs=0.05)

@pytest.mark.asyncio
async def test_run_study_pipeline_mock():
    meta = {
        "original_shape": [512, 512],
        "pixel_spacing_mm": [0.7, 0.7],
        "slice_thickness_mm": 1.25,
        "slice_z_mm": [i * 1.25 for i in range(10)],
    }
    dummy_b64 = ["iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="] * 4
    output_b, output_d, report_stream = await run_study_pipeline(dummy_b64, meta, mock_mode=True)
    assert output_b["lung_rads_category"] in ["1", "2", "3", "4A", "4B", "4X"]
    assert "detections" in output_d
    assert len(output_d["detections"]) > 0
    assert "physical_size" in output_d["detections"][0]
    assert report_stream is not None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.\.venv\Scripts\python.exe -m pytest tests/test_inference_router.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.services.inference_router'`

- [ ] **Step 3: Implement `apps/api/app/services/inference_router.py`**

Implement `LungRADSOutput`, `LesionBox3D`, `DetectionOutput`, `box_to_physical_mm`, and `run_study_pipeline`. Ensure `extra_body={"guided_json": ...}` and `repetition_penalty=1.05` are passed to vLLM. Add fallback mock responses when `client is None` or `mock_mode=True` for test reproducibility.

- [ ] **Step 4: Run test to verify it passes**

Run: `.\.venv\Scripts\python.exe -m pytest tests/test_inference_router.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/services/inference_router.py tests/test_inference_router.py
git commit -m "feat(pipeline): implement parallel constrained router and physical coordinate mapper"
```

---

### Task 4: Stateful Warm-Prefix VQA Streaming Session (gRPC & SSE)

**Files:**
- Create: `apps/api/app/services/vqa_stream_server.py`
- Test: `tests/test_vqa_stream_server.py`

**Interfaces:**
- Consumes: `study_id`, live questions, warm prefix cache in memory
- Produces: `MedGemmaVQAServicer` (gRPC async servicer), `MedGemmaVQASessionManager` (SSE / async stream generator)

- [ ] **Step 1: Write the failing test**

```python
# tests/test_vqa_stream_server.py
import pytest
from app.services.vqa_stream_server import MedGemmaVQASessionManager

@pytest.mark.asyncio
async def test_vqa_session_lifecycle():
    manager = MedGemmaVQASessionManager()
    study_id = "STUDY-TEST-001"
    dummy_b64 = ["b64_slice_1", "b64_slice_2"]

    # Register study prefix
    manager.register_study_prefix(study_id, dummy_b64)
    assert manager.has_study(study_id)

    # Stream multi-turn session in mock mode
    turn_1_tokens = []
    async for chunk in manager.stream_question(study_id, "Is there a nodule in the right lower lobe?", mock_mode=True):
        turn_1_tokens.append(chunk["token"])

    turn_1_text = "".join(turn_1_tokens)
    assert len(turn_1_text) > 0
    # Verify session history grew
    session = manager.get_session(study_id)
    assert len(session["messages"]) == 3  # system + user + assistant
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.\.venv\Scripts\python.exe -m pytest tests/test_vqa_stream_server.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.services.vqa_stream_server'`

- [ ] **Step 3: Implement `apps/api/app/services/vqa_stream_server.py`**

Implement `MedGemmaVQASessionManager` and `MedGemmaVQAServicer`. Support TTL-based session eviction, prefix caching message array structuring, and streaming responses with TTFT metric recording.

- [ ] **Step 4: Run test to verify it passes**

Run: `.\.venv\Scripts\python.exe -m pytest tests/test_vqa_stream_server.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/services/vqa_stream_server.py tests/test_vqa_stream_server.py
git commit -m "feat(vqa): implement stateful warm-prefix interactive VQA streaming session"
```

---

### Task 5: Hybrid MONAI 3D Segmentation Fallback & Volumetric API Router Integration

**Files:**
- Create: `apps/api/app/services/monai_segmentation_fallback.py`
- Modify: `apps/api/app/api/v1/volumetric.py`
- Test: `tests/test_monai_segmentation_fallback.py`
- Test: `tests/test_volumetric_api.py`

**Interfaces:**
- Consumes: `box_2d`, `slice_index`, raw HU volume
- Produces: `compute_cubic_mm_volume(volume_hu, spacing_xyz, detection) -> dict`, new endpoints `/api/v1/volumetric/ct/dag-pipeline` and `/api/v1/volumetric/ct/vqa-stream`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_monai_segmentation_fallback.py
import numpy as np
import pytest
from app.services.monai_segmentation_fallback import compute_cubic_mm_volume

def test_compute_cubic_mm_volume():
    # Synthetic volume with known spherical lesion of radius 5 voxels
    vol = np.full((32, 64, 64), -1000.0, dtype=np.float32)
    # Lesion at slice 16, y=32, x=32
    Y, X = np.ogrid[:64, :64]
    mask_2d = ((X - 32)**2 + (Y - 32)**2) <= 25
    vol[14:19, mask_2d] = 45.0
    spacing = (1.0, 1.0, 1.5)

    detection = {
        "slice_index": 16,
        "box_2d": [int(27 / 64 * 1000), int(27 / 64 * 1000), int(37 / 64 * 1000), int(37 / 64 * 1000)],
    }
    result = compute_cubic_mm_volume(vol, spacing, detection)
    assert result["volume_mm3"] > 0
    assert result["mean_hu"] == pytest.approx(45.0, abs=2.0)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.\.venv\Scripts\python.exe -m pytest tests/test_monai_segmentation_fallback.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.services.monai_segmentation_fallback'`

- [ ] **Step 3: Implement `apps/api/app/services/monai_segmentation_fallback.py` and mount routes in `apps/api/app/api/v1/volumetric.py`**

Create `compute_cubic_mm_volume` using localized 3D thresholding / active contour / MONAI segmentation hook. In `volumetric.py`, expose `POST /ct/dag-pipeline` and `POST /ct/vqa-stream` using the new inference router and session manager.

- [ ] **Step 4: Run test to verify it passes**

Run: `.\.venv\Scripts\python.exe -m pytest tests/test_monai_segmentation_fallback.py tests/test_volumetric_api.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/services/monai_segmentation_fallback.py apps/api/app/api/v1/volumetric.py tests/test_monai_segmentation_fallback.py
git commit -m "feat(api): integrate MONAI 3D volumetry fallback and prefix-cached DAG routes"
```

---

### Task 6: End-to-End Verification & Regression Suite

**Files:**
- Create: `tests/test_prefix_cached_dag.py`
- Test: Full test suite

**Step 1:** Write comprehensive end-to-end integration test validating the entire DAG flow:
1. HU windowing
2. Parallel Output B & D execution with repetition penalty
3. Physical mm coordinate conversion
4. Grounded Output A report generation
5. Multi-turn Output C VQA session
6. 3D segmentation fallback

**Step 2:** Run all tests across the repository:
`.\.venv\Scripts\python.exe -m pytest tests/ -v`

**Step 3:** Commit:
```bash
git add tests/test_prefix_cached_dag.py
git commit -m "test(integration): verify end-to-end prefix-cached dual-path DAG pipeline"
```
