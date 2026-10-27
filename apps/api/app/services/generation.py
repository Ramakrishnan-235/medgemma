"""Shared HTTP and response handling for all MedGemma workflows."""

import json
import re
from typing import Any

import httpx

from app.core.config import settings


async def request_generation(
    base_url: str,
    payload: dict[str, Any],
    *,
    client: httpx.AsyncClient | None = None,
    timeout: float = 120.0,
) -> dict[str, Any]:
    """Borrow injected clients; close only clients created for this request."""
    if client is None:
        async with httpx.AsyncClient(timeout=timeout) as owned_client:
            return await request_generation(base_url, payload, client=owned_client, timeout=timeout)
    response = await client.post(f"{base_url.rstrip('/')}/v1/generate", json=payload, timeout=timeout)
    response.raise_for_status()
    data = response.json()
    if not isinstance(data, dict):
        raise ValueError("MedGemma service response must be a JSON object.")
    return data


def generated_text(data: dict[str, Any]) -> str:
    raw = data.get("generated_text") or data.get("text") or ""
    if not isinstance(raw, str):
        raise ValueError("MedGemma generated text must be a string.")
    raw = raw.strip()
    if raw.startswith("```") and raw.endswith("```"):
        raw = raw[3:-3].removeprefix("json").strip()
    return raw


def parse_generated_object(raw: str) -> dict[str, Any] | None:
    """Non-object JSON and prose use each workflow's existing fallback."""
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", raw, re.DOTALL)
    if match:
        try:
            parsed = json.loads(match.group(1))
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            pass
    return None


def generation_telemetry(
    data: dict[str, Any], prompt_version: str | None = None
) -> dict[str, Any]:
    telemetry = {
        "model_checkpoint": data.get("model_checkpoint", settings.MEDGEMMA_CHECKPOINT),
        "processor_version": data.get("processor_version", settings.MEDGEMMA_PROCESSOR_VERSION),
        "execution_mode": data.get("execution_mode", settings.MEDGEMMA_MODE),
        **{key: data.get(key, 0) for key in (
            "queue_wait_ms", "inference_ms", "input_token_count", "output_token_count"
        )},
    }
    if prompt_version is not None:
        telemetry["prompt_template_version"] = prompt_version
    return telemetry
