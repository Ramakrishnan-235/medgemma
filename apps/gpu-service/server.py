import http.server
import json
import logging
import os
import sys

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("gpu-service")

PORT = int(os.getenv("PORT", "8080"))
MODE = os.getenv("MEDGEMMA_MODE", "local_4bit")
CHECKPOINT = os.getenv("MEDGEMMA_CHECKPOINT", "google/medgemma-1.5-4b-it")
MAX_REQUEST_BYTES = 16 * 1024 * 1024
MOCK_MODE = "mock_deterministic"


def generate_response(payload: dict, mode: str) -> dict:
    """This HTTP scaffold implements deterministic fixtures only."""
    if mode != MOCK_MODE:
        raise NotImplementedError("Local model inference is not implemented in this HTTP service.")
    if not isinstance(payload.get("user_prompt"), str):
        raise ValueError("user_prompt must be a string.")
    output = {
        "answer_markdown": "Frontal chest radiograph demonstrates focal consolidation in the right lower lung zone [cit_1].",
        "cited_keys": ["cit_1"],
        "box_2d_1000": [440, 224, 528, 312],
    }
    return {
        "generated_text": json.dumps(output),
        "model_checkpoint": CHECKPOINT,
        "processor_version": "1.5.0-896px",
        "execution_mode": MOCK_MODE,
        "queue_wait_ms": 0,
        "inference_ms": 0,
        "input_token_count": 0,
        "output_token_count": 0,
    }


class GPUHandler(http.server.BaseHTTPRequestHandler):
    def log_message(self, format: str, *args) -> None:
        logger.info("%s - %s", self.address_string(), format % args)

    def _send_json(self, status: int, data: dict) -> None:
        payload = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self) -> None:
        if self.path in ("/health", "/healthz", "/"):
            ready = MODE == MOCK_MODE
            self._send_json(200 if ready else 503, {
                "status": "mock_ready" if ready else "inference_not_implemented",
                "service": "medgemma-gpu-service",
                "mode": MODE,
                "checkpoint": CHECKPOINT,
            })
        elif self.path == "/v1/models":
            self._send_json(200, {
                "object": "list",
                "data": [{"id": CHECKPOINT, "object": "model", "owned_by": "medgemma"}],
            })
        else:
            self._send_json(404, {"error": "Not found", "path": self.path})

    def do_POST(self) -> None:
        if self.path == "/v1/generate":
            try:
                content_length = int(self.headers.get("Content-Length", "0"))
                if content_length <= 0:
                    raise ValueError("A non-empty JSON body is required.")
                if content_length > MAX_REQUEST_BYTES:
                    self._send_json(413, {"error": "Request body exceeds 16 MiB."})
                    return
                body = self.rfile.read(content_length)
                payload = json.loads(body.decode("utf-8"))
                if not isinstance(payload, dict):
                    raise ValueError("Request body must be a JSON object.")
                response = generate_response(payload, MODE)
            except (ValueError, UnicodeDecodeError) as exc:
                self._send_json(400, {"error": str(exc)})
                return
            except NotImplementedError as exc:
                self._send_json(503, {"error": str(exc), "mode": MODE})
                return
            self._send_json(200, response)
        else:
            self._send_json(404, {"error": "Not found", "path": self.path})


def main() -> None:
    logger.info("Starting GPU Inference Service on port %d (Mode: %s)...", PORT, MODE)
    http.server.ThreadingHTTPServer.allow_reuse_address = True
    with http.server.ThreadingHTTPServer(("", PORT), GPUHandler) as httpd:
        httpd.timeout = 60.0
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            logger.info("Shutting down GPU Inference Service...")
            httpd.server_close()
            sys.exit(0)


if __name__ == "__main__":
    main()
