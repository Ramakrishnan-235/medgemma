# app/services/medgemma_service.py
import os
import base64
import io
from openai import AsyncOpenAI
from PIL import Image

class DockerizedMedGemmaService:
    def __init__(self):
        # Points to the medgemma-engine container defined in docker-compose.yml or Docker Model Runner
        base_url = os.getenv("MEDGEMMA_BASE_URL", "http://medgemma-engine:8000/v1")
        self.model = os.getenv("MEDGEMMA_MODEL", "google/medgemma-1.5-4b")
        self.client = AsyncOpenAI(base_url=base_url, api_key="none")

    async def generate_reasoning_trace(self, images_64: list[Image.Image], telemetry: dict, roi_metrics: dict) -> str:
        # 1. Format the 64 slices as base64 data URLs
        image_contents = []
        for img in images_64:
            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=85)
            b64_str = base64.b64encode(buf.getvalue()).decode("utf-8")
            image_contents.append({
                "type": "image_url",
                "image_url": {"url": f"data:image/jpeg;base64,{b64_str}"}
            })

        # 2. Formulate clinical grounding prompt
        prompt_text = (
            f"You are an expert diagnostic imaging AI analyzing a 3D CT study.\n"
            f"Scanner: {telemetry['matrix']}, Kernel: {telemetry['kernel']}, Slice: {telemetry['slice_thickness_mm']}mm.\n"
            f"Active Lesion: Axial Slice {roi_metrics['peak_slice']}, Dimensions: {roi_metrics['dimensions_str']}, "
            f"Volume: {roi_metrics['volume_cm3']} cm3, Attenuation: {roi_metrics['mean_hu']} HU.\n"
            f"Examine the 64 sampled axial slices. Provide the AI Reasoning Trace and follow-up protocol."
        )

        messages = [
            {
                "role": "user",
                "content": [{"type": "text", "text": prompt_text}, *image_contents]
            }
        ]

        # 3. Request inference with token streaming
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            max_tokens=350,
            temperature=0.2,
        )
        return response.choices[0].message.content

