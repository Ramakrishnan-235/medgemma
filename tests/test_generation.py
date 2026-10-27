import json
import unittest
import uuid

import httpx

from app.services.ehr_summarizer import TwoPassEHRSummarizer
from app.services.generation import generated_text, parse_generated_object, request_generation
from app.services.medgemma_adapter import MedGemmaAdapter


class TestGeneration(unittest.IsolatedAsyncioTestCase):
    def test_non_object_json_and_plain_text_use_workflow_fallback(self):
        for text in ('[]', 'null', '42', 'plain text'):
            self.assertIsNone(parse_generated_object(text))
        self.assertEqual(parse_generated_object(generated_text({
            "generated_text": '```json\n{"facts": []}\n```',
        })), {"facts": []})
        # Prose with code fence extraction fallback
        prose_with_fence = 'Here is the diagnosis:\n```json\n{"condition": "pneumonia"}\n```\nHope this helps!'
        self.assertEqual(parse_generated_object(prose_with_fence), {"condition": "pneumonia"})
        prose_with_plain_fence = 'Analysis:\n```\n{"result": "normal"}\n```'
        self.assertEqual(parse_generated_object(prose_with_plain_fence), {"result": "normal"})

    async def test_request_generation_timeout_forwarded(self):
        recorded_timeout = None

        def handler(request):
            nonlocal recorded_timeout
            recorded_timeout = request.extensions.get("timeout", {}).get("connect")
            return httpx.Response(200, json={"model_checkpoint": "test", "execution_mode": "mock"})

        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            res = await request_generation("http://gpu", {}, client=client, timeout=45.0)
            self.assertEqual(res["model_checkpoint"], "test")

    async def test_borrowed_client_is_not_closed_and_http_errors_propagate(self):
        def respond(request):
            self.assertEqual(str(request.url), "http://gpu/v1/generate")
            return httpx.Response(503, json={"error": "Unavailable"})

        async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
            with self.assertRaises(httpx.HTTPStatusError):
                await request_generation("http://gpu/", {}, client=client)
            self.assertFalse(client.is_closed)

    async def test_non_object_service_envelope_is_rejected(self):
        async with httpx.AsyncClient(transport=httpx.MockTransport(
            lambda request: httpx.Response(200, json=[]),
        )) as client:
            with self.assertRaisesRegex(ValueError, "JSON object"):
                await request_generation("http://gpu", {}, client=client)

    async def test_citations_are_deduplicated_and_malformed_keys_are_ignored(self):
        response = {"generated_text": json.dumps({
            "answer_markdown": "Synthetic [cit_1]", "cited_keys": ["cit_1", "cit_1", {}, "cit_99"],
        })}
        async with httpx.AsyncClient(transport=httpx.MockTransport(
            lambda request: httpx.Response(200, json=response),
        )) as client:
            output = await MedGemmaAdapter("http://gpu", client).generate_grounded_answer(
                "Synthetic?", {"cit_1": {
                    "id": uuid.uuid4(), "source_file_id": uuid.uuid4(), "content_text": "Synthetic",
                }},
            )
        self.assertEqual([c.citation_id for c in output.citations], ["cit_1"])

    async def test_ehr_handles_non_object_json_and_missing_telemetry(self):
        async with httpx.AsyncClient(transport=httpx.MockTransport(
            lambda request: httpx.Response(200, json={"generated_text": "[]"}),
        )) as client:
            parsed, telemetry = await TwoPassEHRSummarizer("http://gpu", client)._call_medgemma_json("", "")
        self.assertEqual(parsed, {})
        self.assertEqual(telemetry["inference_ms"], 0)
