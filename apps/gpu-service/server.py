import http.server
import json
import logging
import os
import socketserver
import sys

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("gpu-service")

PORT = int(os.getenv("PORT", "8080"))
MODE = os.getenv("MEDGEMMA_MODE", "local_4bit")
CHECKPOINT = os.getenv("MEDGEMMA_CHECKPOINT", "google/medgemma-1.5-4b-it")


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
            self._send_json(200, {
                "status": "ready",
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


def main() -> None:
    logger.info("Starting GPU Inference Service on port %d (Mode: %s)...", PORT, MODE)
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), GPUHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            logger.info("Shutting down GPU Inference Service...")
            httpd.server_close()
            sys.exit(0)


if __name__ == "__main__":
    main()
