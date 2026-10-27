import http.server
import os
import sys
import threading
import unittest
from unittest.mock import patch

import httpx

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "gpu-service")))
import server


class TestGPUServiceHTTP(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.httpd = http.server.HTTPServer(("127.0.0.1", 0), server.GPUHandler)
        cls.thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.thread.start()
        cls.client = httpx.Client(base_url=f"http://127.0.0.1:{cls.httpd.server_port}", trust_env=False)

    @classmethod
    def tearDownClass(cls):
        cls.client.close()
        cls.httpd.shutdown()
        cls.httpd.server_close()
        cls.thread.join(timeout=2)

    def test_mock_mode_is_explicit_in_health_and_generation(self):
        with patch.object(server, "MODE", "mock_deterministic"):
            self.assertEqual(self.client.get("/health").json()["status"], "mock_ready")
            response = self.client.post("/v1/generate", json={"user_prompt": "Synthetic fixture"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["execution_mode"], "mock_deterministic")
        self.assertEqual(response.json()["input_token_count"], 0)

    def test_unimplemented_real_mode_does_not_return_fixture_as_inference(self):
        with patch.object(server, "MODE", "local_4bit"):
            self.assertEqual(self.client.get("/health").status_code, 503)
            response = self.client.post("/v1/generate", json={"user_prompt": "Synthetic fixture"})
        self.assertEqual(response.status_code, 503)
        self.assertNotIn("generated_text", response.json())

    def test_invalid_payloads_return_400(self):
        with patch.object(server, "MODE", "mock_deterministic"):
            for body in (b"not json", b"[]", b"{}", b'{"user_prompt": 12}'):
                with self.subTest(body=body):
                    response = self.client.post("/v1/generate", content=body)
                    self.assertEqual(response.status_code, 400)

    def test_unknown_routes_return_404(self):
        self.assertEqual(self.client.get("/missing").status_code, 404)
        self.assertEqual(self.client.post("/missing", json={}).status_code, 404)
