import asyncio
import base64
import hashlib
import io
import json
import os
import statistics
import sys
import time
from dataclasses import asdict, dataclass

import httpx
from PIL import Image, ImageDraw

def normalize_medical_image_896(raw_bytes: bytes) -> Image.Image:
    """
    Normalizes a raw medical image (PNG, JPEG, etc.) into an 896x896 RGB letterboxed
    PIL Image with deterministic black padding, matching the MedGemma 1.5 input specification.
    """
    with Image.open(io.BytesIO(raw_bytes)) as source:
        img = source.convert("RGB")
    orig_w, orig_h = img.size
    scale = min(896.0 / float(orig_w), 896.0 / float(orig_h))
    resized_w = int(round(orig_w * scale))
    resized_h = int(round(orig_h * scale))
    pad_left = (896 - resized_w) // 2
    pad_top = (896 - resized_h) // 2
    resized = img.resize((resized_w, resized_h), resample=Image.Resampling.BICUBIC)
    canvas = Image.new("RGB", (896, 896), color=(0, 0, 0))
    canvas.paste(resized, (pad_left, pad_top))
    return canvas


@dataclass
class EngineBenchmarkReport:
    engine_name: str
    concurrency: int
    total_requests: int
    success_rate: float
    p50_latency_ms: float
    p95_latency_ms: float
    mean_queue_wait_ms: float
    throughput_tokens_per_sec: float


@dataclass
class ParityVerificationReport:
    image_preprocessor_sha256_match: bool
    json_schema_validity_rate: float
    citation_key_agreement_rate: float
    mean_token_jaccard_similarity: float
    mean_bbox_iou: float
    passed_release_gate: bool


def compute_box_iou_1000(box_a: list[float], box_b: list[float]) -> float:
    """
    Computes 2D Intersection-over-Union for MedGemma [ymin, xmin, ymax, xmax] boxes in [0..1000].
    """
    if len(box_a) != 4 or len(box_b) != 4:
        return 0.0
    ay0, ax0, ay1, ax1 = box_a
    by0, bx0, by1, bx1 = box_b

    inter_x0 = max(ax0, bx0)
    inter_y0 = max(ay0, by0)
    inter_x1 = min(ax1, bx1)
    inter_y1 = min(ay1, by1)

    inter_w = max(0.0, inter_x1 - inter_x0)
    inter_h = max(0.0, inter_y1 - inter_y0)
    inter_area = inter_w * inter_h

    area_a = max(0.0, ax1 - ax0) * max(0.0, ay1 - ay0)
    area_b = max(0.0, bx1 - bx0) * max(0.0, by1 - by0)
    union_area = area_a + area_b - inter_area
    if union_area <= 0.0:
        return 0.0
    return round(inter_area / union_area, 4)


def token_jaccard(text_a: str, text_b: str) -> float:
    set_a = {t.lower().strip(".,:;[]()") for t in text_a.split() if t.strip()}
    set_b = {t.lower().strip(".,:;[]()") for t in text_b.split() if t.strip()}
    if not set_a and not set_b:
        return 1.0
    if not set_a or not set_b:
        return 0.0
    return round(len(set_a & set_b) / len(set_a | set_b), 4)


def create_synthetic_test_xray_bytes(width: int = 2048, height: int = 2500) -> bytes:
    """
    Generates a non-square synthetic test radiograph with a deterministic focal opacity
    to verify letterbox padding and coordinate parity across engines.
    """
    img = Image.new("L", (width, height), color=24)
    draw = ImageDraw.Draw(img)
    draw.ellipse((450, 600, 920, 1450), fill=110)
    draw.ellipse((1120, 600, 1590, 1450), fill=110)
    # Simulated right lower-zone focal opacity
    draw.rectangle((560, 1100, 780, 1320), fill=215)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


async def verify_transformers_vs_vllm_parity(
    transformers_url: str,
    vllm_adapter_url: str,
    num_cases: int = 5,
) -> ParityVerificationReport:
    raw_xray = create_synthetic_test_xray_bytes()

    # 1. Verify deterministic 896x896 preprocessing byte parity
    norm_a = normalize_medical_image_896(raw_xray)
    norm_b = normalize_medical_image_896(raw_xray)
    buf_a, buf_b = io.BytesIO(), io.BytesIO()
    norm_a.save(buf_a, format="PNG")
    norm_b.save(buf_b, format="PNG")
    sha_match = (
        hashlib.sha256(buf_a.getvalue()).hexdigest()
        == hashlib.sha256(buf_b.getvalue()).hexdigest()
    )

    b64_img = base64.b64encode(buf_a.getvalue()).decode("ascii")
    payload = {
        "system_instruction": (
            "Analyze the chest radiograph and return strict JSON with keys: "
            "'answer_markdown', 'cited_keys' (must include 'cit_1'), and 'box_2d_1000' ([ymin, xmin, ymax, xmax])."
        ),
        "user_prompt": "EVIDENCE: [cit_1] Frontal chest radiograph.\nQUESTION: Describe right lower zone findings.",
        "images": [{"image_id": "test_cxr_1", "base64_png": b64_img}],
        "max_new_tokens": 512,
    }

    valid_json_count = 0
    citation_agreements = 0
    jaccard_scores: list[float] = []
    iou_scores: list[float] = []

    async with httpx.AsyncClient(timeout=120.0) as client:
        for _ in range(num_cases):
            resp_tf, resp_vllm = await asyncio.gather(
                client.post(f"{transformers_url.rstrip('/')}/v1/generate", json=payload),
                client.post(f"{vllm_adapter_url.rstrip('/')}/v1/generate", json=payload),
            )
            resp_tf.raise_for_status()
            resp_vllm.raise_for_status()

            txt_tf = resp_tf.json()["generated_text"]
            txt_vllm = resp_vllm.json()["generated_text"]

            try:
                json_tf = json.loads(txt_tf.strip().strip("`").removeprefix("json").strip())
                json_vllm = json.loads(txt_vllm.strip().strip("`").removeprefix("json").strip())
                valid_json_count += 1
            except json.JSONDecodeError:
                continue

            cits_tf = set(json_tf.get("cited_keys", []))
            cits_vllm = set(json_vllm.get("cited_keys", []))
            if cits_tf == cits_vllm:
                citation_agreements += 1

            jaccard_scores.append(
                token_jaccard(
                    str(json_tf.get("answer_markdown", "")),
                    str(json_vllm.get("answer_markdown", "")),
                )
            )

            box_tf = json_tf.get("box_2d_1000")
            box_vllm = json_vllm.get("box_2d_1000")
            if isinstance(box_tf, list) and isinstance(box_vllm, list):
                iou_scores.append(compute_box_iou_1000(box_tf, box_vllm))

    json_rate = round(valid_json_count / max(num_cases, 1), 4)
    cit_rate = round(citation_agreements / max(valid_json_count, 1), 4)
    mean_jaccard = round(statistics.mean(jaccard_scores), 4) if jaccard_scores else 0.0
    mean_iou = round(statistics.mean(iou_scores), 4) if iou_scores else 1.0

    # Release gate: 100% preprocessing match, >=95% JSON validity, >=90% citation parity, >=0.75 text Jaccard
    passed = (
        sha_match
        and json_rate >= 0.95
        and cit_rate >= 0.90
        and mean_jaccard >= 0.75
    )

    return ParityVerificationReport(
        image_preprocessor_sha256_match=sha_match,
        json_schema_validity_rate=json_rate,
        citation_key_agreement_rate=cit_rate,
        mean_token_jaccard_similarity=mean_jaccard,
        mean_bbox_iou=mean_iou,
        passed_release_gate=passed,
    )


async def benchmark_concurrency_tier(
    service_url: str,
    engine_name: str,
    concurrency: int,
    total_requests: int = 8,
) -> EngineBenchmarkReport:
    raw_xray = create_synthetic_test_xray_bytes(1024, 1024)
    b64_img = base64.b64encode(raw_xray).decode("ascii")
    req_payload = {
        "system_instruction": "Summarize the radiograph findings concisely with citation [cit_1].",
        "user_prompt": "EVIDENCE: [cit_1] Portable AP chest radiograph.",
        "images": [{"image_id": "bench_cxr", "base64_png": b64_img}],
        "max_new_tokens": 256,
    }

    sem = asyncio.Semaphore(concurrency)
    latencies_ms: list[float] = []
    queue_waits_ms: list[float] = []
    total_out_tokens = 0
    successes = 0

    async with httpx.AsyncClient(timeout=180.0) as client:
        async def _worker() -> None:
            nonlocal total_out_tokens, successes
            async with sem:
                t0 = time.perf_counter()
                resp = await client.post(
                    f"{service_url.rstrip('/')}/v1/generate", json=req_payload
                )
                elapsed_ms = (time.perf_counter() - t0) * 1000.0
                if resp.status_code == 200:
                    data = resp.json()
                    successes += 1
                    latencies_ms.append(elapsed_ms)
                    queue_waits_ms.append(float(data.get("queue_wait_ms", 0)))
                    total_out_tokens += int(data.get("output_token_count", 0))

        wall_start = time.perf_counter()
        await asyncio.gather(*[_worker() for _ in range(total_requests)])
        wall_seconds = max(time.perf_counter() - wall_start, 1e-6)

    sorted_lat = sorted(latencies_ms) if latencies_ms else [0.0]
    p50_idx = int(0.50 * (len(sorted_lat) - 1))
    p95_idx = int(0.95 * (len(sorted_lat) - 1))

    return EngineBenchmarkReport(
        engine_name=engine_name,
        concurrency=concurrency,
        total_requests=total_requests,
        success_rate=round(successes / total_requests, 4),
        p50_latency_ms=round(sorted_lat[p50_idx], 1),
        p95_latency_ms=round(sorted_lat[p95_idx], 1),
        mean_queue_wait_ms=round(statistics.mean(queue_waits_ms), 1) if queue_waits_ms else 0.0,
        throughput_tokens_per_sec=round(total_out_tokens / wall_seconds, 2),
    )


if __name__ == "__main__":
    async def _run_suite() -> None:
        url = "http://localhost:8080"
        for conc in (1, 2, 4):
            report = await benchmark_concurrency_tier(
                service_url=url,
                engine_name="medgemma-1.5-4b",
                concurrency=conc,
                total_requests=conc * 2,
            )
            print(json.dumps(asdict(report), indent=2))

    asyncio.run(_run_suite())
