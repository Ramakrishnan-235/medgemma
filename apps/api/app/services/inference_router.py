import asyncio
import json
import os
from typing import Any, AsyncGenerator, Dict, List, Literal, Tuple
from openai import AsyncOpenAI
from pydantic import BaseModel, Field

MODEL_ID = os.getenv("MEDGEMMA_MODEL_ID", "google/medgemma-1.5-4b-it")
VLLM_BASE_URL = os.getenv("MEDGEMMA_BASE_URL", "http://localhost:8000/v1")


# --- Output B Schema: Classification & Lung-RADS ---
class LungRADSOutput(BaseModel):
    lung_rads_category: Literal["1", "2", "3", "4A", "4B", "4X"]
    malignancy_risk_score: float = Field(ge=0.0, le=1.0)
    primary_findings: List[str]
    recommended_follow_up: str


# --- Output D Schema: Slice-Anchored Bounding Boxes ---
class LesionBox3D(BaseModel):
    slice_index: int = Field(description="0-based index of the axial slice")
    label: str
    box_2d: List[int] = Field(
        min_length=4,
        max_length=4,
        description="[ymin, xmin, ymax, xmax] normalized 0 to 1000",
    )


class DetectionOutput(BaseModel):
    detections: List[LesionBox3D]


def box_to_physical_mm(box_2d: List[int], meta: Dict[str, Any]) -> Dict[str, float]:
    """
    Converts MedGemma [0-1000] normalized 2D coordinates into physical mm dimensions
    using the DICOM affine spacing matrix and original acquisition resolution.
    """
    ymin, xmin, ymax, xmax = box_2d
    orig_h, orig_w = meta.get("original_shape", [512, 512])
    row_mm, col_mm = meta.get("pixel_spacing_mm", [0.7, 0.7])

    height_mm = ((ymax - ymin) / 1000.0) * orig_h * row_mm
    width_mm = ((xmax - xmin) / 1000.0) * orig_w * col_mm
    mean_diameter_mm = round((height_mm + width_mm) / 2.0, 2)

    return {
        "width_mm": round(width_mm, 2),
        "height_mm": round(height_mm, 2),
        "mean_diameter_mm": mean_diameter_mm,
    }


async def _async_mock_stream(text_chunks: List[str]) -> AsyncGenerator[str, None]:
    for chunk in text_chunks:
        await asyncio.sleep(0.005)
        yield chunk


async def _wrap_openai_stream(stream: Any) -> AsyncGenerator[str, None]:
    async for chunk in stream:
        delta = chunk.choices[0].delta.content or ""
        if delta:
            yield delta


async def run_study_pipeline(
    base64_slices: List[str],
    spatial_meta: Dict[str, Any],
    client: AsyncOpenAI | None = None,
    mock_mode: bool = False,
) -> Tuple[Dict[str, Any], Dict[str, Any], AsyncGenerator[str, None]]:
    """
    Executes the Prefix-Cached Dual-Path DAG:
    1. Warms the KV-cache using an identical shared vision prefix across all branches.
    2. Runs Output B (Lung-RADS JSON) and Output D (Bounding Boxes JSON) in parallel via XGrammar.
    3. Projects 2D bounding boxes into physical millimeters using DICOM affine metadata.
    4. Streams Output A (Grounded Clinical Report) without re-encoding the 3D volume.
    """
    shared_vision_prefix = [
        {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}"}}
        for b64 in base64_slices
    ]

    if mock_mode or client is None:
        # Deterministic offline mock for CI/CD testing environments
        output_b = {
            "lung_rads_category": "4A",
            "malignancy_risk_score": 0.12,
            "primary_findings": [
                "9.5 mm solid pulmonary nodule in the right lower lobe posterior segment.",
                "Smooth margins without architectural distortion or pleural tethering.",
            ],
            "recommended_follow_up": "3-month low-dose CT or PET-CT examination per ACR Lung-RADS v2022 guidelines.",
        }

        target_slice = min(32, len(base64_slices) - 1) if base64_slices else 0
        raw_box = [380, 420, 440, 490]  # normalized 0-1000
        output_d = {
            "detections": [
                {
                    "slice_index": target_slice,
                    "label": "Solid Pulmonary Nodule",
                    "box_2d": raw_box,
                }
            ]
        }

        # Calculate physical dimensions
        for det in output_d["detections"]:
            det["physical_size"] = box_to_physical_mm(det["box_2d"], spatial_meta)
            z_coords = spatial_meta.get("slice_z_mm", [])
            s_idx = det["slice_index"]
            det["z_coord_mm"] = z_coords[s_idx] if s_idx < len(z_coords) else 0.0

        mock_report_chunks = [
            "# Chest CT Clinical Evaluation\n\n",
            "## Findings\n",
            "- Lungs: 9.5 mm solid nodule in the right lower lobe (mean attenuation 42 HU). No additional lesions.\n",
            "- Pleura: Clear; no effusion or thickening.\n",
            "- Mediastinum: Normal lymph nodes without mediastinal lymphadenopathy.\n\n",
            "## Impression\n",
            "1. Single 9.5 mm solid right lower lobe pulmonary nodule, ACR Lung-RADS Category 4A.\n",
            "2. Recommendation: 3-month follow-up low-dose CT examination.",
        ]
        return output_b, output_d, _async_mock_stream(mock_report_chunks)

    # 1. Warm KV-Cache and run Output B & Output D concurrently
    task_b = client.chat.completions.create(
        model=MODEL_ID,
        messages=[{
            "role": "user",
            "content": shared_vision_prefix + [{
                "type": "text",
                "text": "Classify this chest CT volume according to Lung-RADS v2022 and output JSON.",
            }],
        }],
        temperature=0.0,
        max_tokens=512,
        extra_body={
            "guided_json": LungRADSOutput.model_json_schema(),
            "repetition_penalty": 1.05,
        },
    )

    task_d = client.chat.completions.create(
        model=MODEL_ID,
        messages=[{
            "role": "user",
            "content": shared_vision_prefix + [{
                "type": "text",
                "text": "Detect all pulmonary nodules. Return slice_index and [ymin, xmin, ymax, xmax] (0-1000).",
            }],
        }],
        temperature=0.0,
        max_tokens=512,
        extra_body={
            "guided_json": DetectionOutput.model_json_schema(),
            "repetition_penalty": 1.05,
        },
    )

    resp_b, resp_d = await asyncio.gather(task_b, task_d)
    output_b = json.loads(resp_b.choices[0].message.content)
    output_d = json.loads(resp_d.choices[0].message.content)

    # Enrich Output D with physical millimeter measurements
    for det in output_d.get("detections", []):
        det["physical_size"] = box_to_physical_mm(det["box_2d"], spatial_meta)
        z_coords = spatial_meta.get("slice_z_mm", [])
        s_idx = det.get("slice_index", 0)
        det["z_coord_mm"] = z_coords[s_idx] if s_idx < len(z_coords) else 0.0

    # 2. Output A: Stream Free-Form Report grounded on Outputs B & D
    grounding_context = json.dumps({"classification": output_b, "lesions": output_d})
    report_stream = await client.chat.completions.create(
        model=MODEL_ID,
        messages=[{
            "role": "user",
            "content": shared_vision_prefix + [{
                "type": "text",
                "text": (
                    f"Generate a comprehensive structured radiology report (Findings & Impression) "
                    f"strictly grounded in these verified measurements: {grounding_context}"
                ),
            }],
        }],
        temperature=0.2,
        max_tokens=1536,
        stream=True,
    )
    return output_b, output_d, _wrap_openai_stream(report_stream)
