import os
import unittest
from unittest.mock import AsyncMock, MagicMock, patch
from PIL import Image

from app.services.medgemma_service import DockerizedMedGemmaService


class TestDockerizedMedGemmaService(unittest.IsolatedAsyncioTestCase):
    def test_default_initialization(self):
        with patch.dict(os.environ, {"MEDGEMMA_BASE_URL": ""}, clear=False):
            os.environ.pop("MEDGEMMA_BASE_URL", None)
            service = DockerizedMedGemmaService()
            self.assertEqual(str(service.client.base_url), "http://medgemma-engine:8000/v1/")

    def test_custom_base_url_initialization(self):
        with patch.dict(os.environ, {"MEDGEMMA_BASE_URL": "http://custom-host:9000/v1"}, clear=False):
            service = DockerizedMedGemmaService()
            self.assertEqual(str(service.client.base_url), "http://custom-host:9000/v1/")

    async def test_generate_reasoning_trace(self):
        with patch.dict(os.environ, {"MEDGEMMA_MODEL": "google/medgemma-1.5-4b"}, clear=False):
            service = DockerizedMedGemmaService()

        # Create dummy 16x16 RGB images simulating slices
        test_images = [Image.new("RGB", (16, 16), color=(i, i, i)) for i in range(2)]

        telemetry = {
            "matrix": "512x512",
            "kernel": "STANDARD",
            "slice_thickness_mm": 1.25,
        }

        roi_metrics = {
            "peak_slice": 32,
            "dimensions_str": "14.2 x 12.8 mm",
            "volume_cm3": 1.45,
            "mean_hu": 38.5,
        }

        mock_response = MagicMock()
        mock_choice = MagicMock()
        mock_choice.message.content = "AI Reasoning Trace: Stable nodule in right upper lobe with soft tissue attenuation."
        mock_response.choices = [mock_choice]

        mock_create = AsyncMock(return_value=mock_response)
        service.client.chat.completions.create = mock_create

        result = await service.generate_reasoning_trace(test_images, telemetry, roi_metrics)

        self.assertEqual(result, "AI Reasoning Trace: Stable nodule in right upper lobe with soft tissue attenuation.")
        mock_create.assert_called_once()

        call_kwargs = mock_create.call_args.kwargs
        self.assertEqual(call_kwargs["model"], "google/medgemma-1.5-4b")
        self.assertEqual(call_kwargs["max_tokens"], 350)
        self.assertEqual(call_kwargs["temperature"], 0.2)

        messages = call_kwargs["messages"]
        self.assertEqual(len(messages), 1)
        self.assertEqual(messages[0]["role"], "user")

        content = messages[0]["content"]
        # 1 text prompt + 2 image_url objects
        self.assertEqual(len(content), 3)
        self.assertEqual(content[0]["type"], "text")
        self.assertIn("Scanner: 512x512, Kernel: STANDARD, Slice: 1.25mm.", content[0]["text"])
        self.assertIn("Active Lesion: Axial Slice 32", content[0]["text"])
        self.assertIn("Volume: 1.45 cm3, Attenuation: 38.5 HU.", content[0]["text"])

        self.assertEqual(content[1]["type"], "image_url")
        self.assertTrue(content[1]["image_url"]["url"].startswith("data:image/jpeg;base64,"))
        self.assertEqual(content[2]["type"], "image_url")
        self.assertTrue(content[2]["image_url"]["url"].startswith("data:image/jpeg;base64,"))


if __name__ == "__main__":
    unittest.main()
