"""
MedGemma Security Posture and Defensive Controls Verification Test Suite

Tests all 8 security criteria identified across Explorer 1, 2, and 3 reports:
  - Test 1: Presence/absence of security headers in Next.js config and Caddyfile (SEC-01 / SEC-04)
  - Test 2: React Query Devtools mounting in production vs development (VULN-01)
  - Test 3: Tiptap AST recursive nesting depth guard against DoS (SEC-05)
  - Test 4: JWT signature verification bypass behavior and claims validation (SEC-01)
  - Test 5: CORS origin parsing against wildcard origin with credentials (SEC-08)
  - Test 6: File upload magic byte enforcement and quarantine (PDF, PNG, JPEG, DICOM)
  - Test 7: Absence of dangerouslySetInnerHTML across frontend components
  - Test 8: Docker Compose port bindings and missing Redis password (SEC-06)
"""

import hashlib
import json
import os
import re
import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

# Set up path resolution to apps/api
API_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "apps", "api"))
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
WEB_ROOT = os.path.join(REPO_ROOT, "apps", "web")

if API_ROOT not in sys.path:
    sys.path.insert(0, API_ROOT)

from app.core.config import Settings, _parse_cors_origins
from app.core.security import _validate_claims, verify_better_auth_jwt
from app.core.storage import PrivateStorageAdapter
from app.api.v1.reports import extract_citation_chips_from_tiptap


class MockStreamingBody:
    """Helper mock for S3 streaming chunk iterator."""
    def __init__(self, data: bytes):
        self._data = data

    def iter_chunks(self, chunk_size: int = 65536):
        for i in range(0, len(self._data), chunk_size):
            yield self._data[i : i + chunk_size]


class TestSecurityPosture(unittest.TestCase):

    # =========================================================================
    # Test 1: Security Headers in Next.js Config & Caddy
    # =========================================================================
    def test_security_headers_configuration_gap(self):
        """Verify presence/absence of security headers in Next.js config and Caddyfile (SEC-01 / SEC-04)."""
        next_config_path = os.path.join(WEB_ROOT, "next.config.ts")
        self.assertTrue(os.path.exists(next_config_path), "next.config.ts must exist")

        with open(next_config_path, "r", encoding="utf-8") as f:
            next_content = f.read()

        # Check for headers() method in next.config.ts
        has_headers_fn = bool(re.search(r"async\s+headers\s*\(\s*\)|headers\s*:\s*(async\s*)?\(\s*\)", next_content))
        has_csp = "Content-Security-Policy" in next_content

        # Verifies the baseline finding: Next.js has no application-level security headers
        self.assertFalse(has_headers_fn, "Baseline observation: next.config.ts lacks headers() method")
        self.assertFalse(has_csp, "Baseline observation: CSP is not configured in next.config.ts")

        # Check Caddy reverse proxy headers
        caddyfile_path = os.path.join(REPO_ROOT, "infra", "caddy", "Caddyfile")
        self.assertTrue(os.path.exists(caddyfile_path), "Caddyfile must exist")

        with open(caddyfile_path, "r", encoding="utf-8") as f:
            caddy_content = f.read()

        self.assertIn("X-Frame-Options", caddy_content)
        self.assertIn("X-Content-Type-Options", caddy_content)
        # Verify gaps identified by Explorer 3:
        self.assertNotIn("Content-Security-Policy", caddy_content, "Caddyfile currently lacks CSP")
        self.assertNotIn("Permissions-Policy", caddy_content, "Caddyfile currently lacks Permissions-Policy")

    # =========================================================================
    # Test 2: React Query Devtools Mounting (VULN-01)
    # =========================================================================
    def test_react_query_devtools_mounting_and_dependencies(self):
        """Verify React Query Devtools mounting in production vs development (VULN-01)."""
        query_provider_path = os.path.join(WEB_ROOT, "src", "providers", "query-provider.tsx")
        self.assertTrue(os.path.exists(query_provider_path), "query-provider.tsx must exist")

        with open(query_provider_path, "r", encoding="utf-8") as f:
            content = f.read()

        # Verify import exists
        self.assertIn("@tanstack/react-query-devtools", content)

        # Check if mounted without NODE_ENV gate
        has_env_check = "process.env.NODE_ENV === \"development\"" in content or "process.env.NODE_ENV === 'development'" in content
        self.assertFalse(has_env_check, "VULN-01 Verified: ReactQueryDevtools is not gated behind NODE_ENV check")

        # Check package.json placement
        pkg_path = os.path.join(WEB_ROOT, "package.json")
        with open(pkg_path, "r", encoding="utf-8") as f:
            pkg = json.load(f)

        in_prod_deps = "@tanstack/react-query-devtools" in pkg.get("dependencies", {})
        self.assertTrue(in_prod_deps, "VULN-01 Verified: @tanstack/react-query-devtools is declared in production dependencies")

    # =========================================================================
    # Test 3: Tiptap AST Recursive Nesting Depth Guard (SEC-05)
    # =========================================================================
    def test_tiptap_ast_recursion_depth_dos(self):
        """Verify Tiptap AST recursive nesting depth DoS vulnerability and safe depth handling (SEC-05)."""
        # 1. Valid AST extracts citations cleanly
        valid_ast = {
            "type": "doc",
            "content": [
                {
                    "type": "paragraph",
                    "content": [
                        {"type": "text", "text": "Patient exhibits left lower lobe opacity "},
                        {"type": "citationChip", "attrs": {"chunk_id": "chunk-101", "label": "[1]"}},
                    ],
                }
            ],
        }
        chips = extract_citation_chips_from_tiptap(valid_ast)
        self.assertEqual(len(chips), 1)
        self.assertEqual(chips[0]["chunk_id"], "chunk-101")

        # 2. Malicious AST with extreme nesting depth (1500 levels)
        deep_node = {"type": "citationChip", "attrs": {"chunk_id": "leaf-node"}}
        for _ in range(1500):
            deep_node = {"type": "paragraph", "content": [deep_node]}

        # In unconstrained Python recursion, exceeding recursionlimit raises RecursionError
        with self.assertRaises(RecursionError):
            extract_citation_chips_from_tiptap(deep_node)

        # 3. Guarded implementation demonstration
        def extract_with_depth_guard(node, max_depth=20, current_depth=0):
            if current_depth > max_depth:
                raise HTTPException(
                    status_code=422,
                    detail=f"Report document structure exceeds maximum allowed nesting depth of {max_depth}."
                )
            collected = []
            if node.get("type") == "citationChip" and isinstance(node.get("attrs"), dict):
                collected.append(node["attrs"])
            for child in node.get("content", []) or []:
                if isinstance(child, dict):
                    collected.extend(extract_with_depth_guard(child, max_depth, current_depth + 1))
            return collected

        # Guarded function safely rejects deep nesting with 422
        with self.assertRaises(HTTPException) as exc_info:
            extract_with_depth_guard(deep_node, max_depth=20)
        self.assertEqual(exc_info.exception.status_code, 422)
        self.assertIn("exceeds maximum allowed nesting depth", exc_info.exception.detail)

    # =========================================================================
    # Test 4: JWT Signature Bypass & Claims Validation (SEC-01)
    # =========================================================================
    def test_jwt_claims_validation(self):
        """Verify JWT claims validation: 'sub' and 'workspace_id' are strictly mandatory."""
        # Missing sub
        with self.assertRaises(HTTPException) as ctx:
            _validate_claims({"workspace_id": "ws-123"})
        self.assertEqual(ctx.exception.status_code, 401)
        self.assertIn("missing 'sub'", ctx.exception.detail)

        # Missing workspace_id
        with self.assertRaises(HTTPException) as ctx:
            _validate_claims({"sub": "user-456"})
        self.assertEqual(ctx.exception.status_code, 401)
        self.assertIn("missing 'workspace_id'", ctx.exception.detail)

        # Valid claims pass without exception
        _validate_claims({"sub": "user-456", "workspace_id": "ws-123"})

    def test_jwt_unverified_bypass_production_guard(self):
        """Verify that DEBUG_ALLOW_UNVERIFIED_JWT cannot be enabled in production environments."""
        for prod_env in ("production", "prod", "staging", "PRODUCTION"):
            with self.assertRaises(ValidationError):
                Settings(ENVIRONMENT=prod_env, DEBUG_ALLOW_UNVERIFIED_JWT=True)

        # Allowed in development or test
        dev_cfg = Settings(ENVIRONMENT="development", DEBUG_ALLOW_UNVERIFIED_JWT=True)
        self.assertTrue(dev_cfg.DEBUG_ALLOW_UNVERIFIED_JWT)

    # =========================================================================
    # Test 5: CORS Origin Parsing & Wildcard Credentials (SEC-08)
    # =========================================================================
    def test_cors_origin_parsing_and_wildcard_credential_risk(self):
        """Verify CORS origin parsing against wildcard origin with credentials (SEC-08)."""
        # Default origins
        defaults = _parse_cors_origins(None)
        self.assertIn("http://localhost:3000", defaults)
        self.assertIn("http://127.0.0.1:3000", defaults)

        # Custom origins
        custom = _parse_cors_origins("https://medgemma.health, https://clinical.medgemma.health")
        self.assertEqual(custom, ["https://medgemma.health", "https://clinical.medgemma.health"])

        # Wildcard origin parsing
        wildcard = _parse_cors_origins("*")
        self.assertEqual(wildcard, ["*"])

        # Validate that wildcard origins with allow_credentials=True violate security specifications
        def validate_origins(origins: list[str], allow_credentials: bool = True) -> list[str]:
            if allow_credentials and "*" in origins:
                raise ValueError("CORS_ORIGINS cannot contain wildcard '*' when allow_credentials=True")
            return origins

        with self.assertRaises(ValueError):
            validate_origins(wildcard, allow_credentials=True)

        # Safe origins pass
        self.assertEqual(validate_origins(["http://localhost:3000"], allow_credentials=True), ["http://localhost:3000"])

    # =========================================================================
    # Test 6: File Upload Magic Byte Enforcement & Quarantine
    # =========================================================================
    def test_file_upload_magic_bytes_enforcement(self):
        """Verify file upload magic byte enforcement and quarantine for PDF, PNG, JPEG, and DICOM."""
        adapter = PrivateStorageAdapter()

        # 1. Valid PDF
        pdf_bytes = b"%PDF-1.7\nSample clinical report header"
        pdf_hash = hashlib.sha256(pdf_bytes).hexdigest()
        mock_s3 = MagicMock()
        mock_s3.get_object.return_value = {"Body": MockStreamingBody(pdf_bytes)}
        adapter.internal_s3 = mock_s3

        info = adapter.verify_uploaded_bytes("cases/test.pdf", pdf_hash, "pdf")
        self.assertEqual(info.detected_kind, "pdf")
        self.assertEqual(info.byte_size, len(pdf_bytes))

        # 2. Invalid PDF (spoofed file) -> triggers quarantine / delete_object and 422
        bad_pdf = b"MZ\x90\x00\x03\x00ExecutableBinaryPayloadDisguisedAsPdf"
        bad_pdf_hash = hashlib.sha256(bad_pdf).hexdigest()
        mock_s3.get_object.return_value = {"Body": MockStreamingBody(bad_pdf)}
        mock_s3.delete_object = MagicMock()

        with self.assertRaises(HTTPException) as exc_info:
            adapter.verify_uploaded_bytes("cases/malicious.pdf", bad_pdf_hash, "pdf")
        self.assertEqual(exc_info.exception.status_code, 422)
        self.assertIn("Invalid PDF magic bytes", exc_info.exception.detail)
        mock_s3.delete_object.assert_called_once_with(Bucket=adapter.bucket, Key="cases/malicious.pdf")

        # 3. Valid PNG
        png_bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"
        png_hash = hashlib.sha256(png_bytes).hexdigest()
        mock_s3.get_object.return_value = {"Body": MockStreamingBody(png_bytes)}
        info = adapter.verify_uploaded_bytes("cases/xray.png", png_hash, "image_png")
        self.assertEqual(info.detected_kind, "image_png")

        # 4. Valid JPEG
        jpeg_bytes = b"\xff\xd8\xff\xe0\x00\x10JFIF"
        jpeg_hash = hashlib.sha256(jpeg_bytes).hexdigest()
        mock_s3.get_object.return_value = {"Body": MockStreamingBody(jpeg_bytes)}
        info = adapter.verify_uploaded_bytes("cases/xray.jpg", jpeg_hash, "image_jpeg")
        self.assertEqual(info.detected_kind, "image_jpeg")

        # 5. Valid DICOM (128 bytes preamble + DICM)
        dicom_bytes = b"\x00" * 128 + b"DICM" + b"patient data"
        dicom_hash = hashlib.sha256(dicom_bytes).hexdigest()
        mock_s3.get_object.return_value = {"Body": MockStreamingBody(dicom_bytes)}
        info = adapter.verify_uploaded_bytes("cases/study.dcm", dicom_hash, "dicom")
        self.assertEqual(info.detected_kind, "dicom")

        # 6. Invalid DICOM (missing DICM at offset 128)
        bad_dicom = b"\x00" * 128 + b"NOPE" + b"bad data"
        bad_dicom_hash = hashlib.sha256(bad_dicom).hexdigest()
        mock_s3.get_object.return_value = {"Body": MockStreamingBody(bad_dicom)}
        mock_s3.delete_object = MagicMock()

        with self.assertRaises(HTTPException) as exc_info:
            adapter.verify_uploaded_bytes("cases/bad.dcm", bad_dicom_hash, "dicom")
        self.assertEqual(exc_info.exception.status_code, 422)
        self.assertIn("Invalid DICOM preamble", exc_info.exception.detail)
        mock_s3.delete_object.assert_called_once()

    # =========================================================================
    # Test 7: Absence of dangerouslySetInnerHTML
    # =========================================================================
    def test_absence_of_dangerously_set_inner_html(self):
        """Verify absence of dangerouslySetInnerHTML and direct innerHTML in frontend components."""
        src_dir = Path(WEB_ROOT) / "src"
        self.assertTrue(src_dir.exists(), "apps/web/src must exist")

        dangerous_occurrences = []
        for file_path in src_dir.rglob("*"):
            if file_path.suffix in (".tsx", ".ts", ".jsx", ".js"):
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    for line_no, line in enumerate(f, start=1):
                        if "dangerouslySetInnerHTML" in line or ".innerHTML =" in line:
                            dangerous_occurrences.append(f"{file_path.name}:{line_no}: {line.strip()}")

        self.assertEqual(
            len(dangerous_occurrences),
            0,
            f"Found dangerous HTML injection patterns: {dangerous_occurrences}",
        )

    # =========================================================================
    # Test 8: Docker Compose Port Exposure & Missing Redis Password (SEC-06)
    # =========================================================================
    def test_docker_compose_port_bindings_and_redis_auth(self):
        """Verify Docker Compose port bindings on 0.0.0.0 and missing Redis password (SEC-06)."""
        full_compose = os.path.join(REPO_ROOT, "docker-compose.full.yml")
        compose_path = full_compose if os.path.exists(full_compose) else os.path.join(REPO_ROOT, "docker-compose.yml")
        self.assertTrue(os.path.exists(compose_path), "docker-compose file must exist")

        with open(compose_path, "r", encoding="utf-8") as f:
            compose_text = f.read()

        # Check Redis port binding and requirepass
        self.assertIn('"6379:6379"', compose_text, "Redis is published to 0.0.0.0:6379")
        self.assertNotIn("127.0.0.1:6379:6379", compose_text, "Redis is not restricted to loopback")
        self.assertNotIn("--requirepass", compose_text, "Redis command is missing --requirepass flag")

        # Check Postgres port binding
        self.assertIn('"5432:5432"', compose_text, "Postgres is published to 0.0.0.0:5432")
        self.assertNotIn("127.0.0.1:5432:5432", compose_text, "Postgres is not restricted to loopback")

        # Check MinIO port bindings
        self.assertIn('"9000:9000"', compose_text, "MinIO is published to 0.0.0.0:9000")
        self.assertNotIn("127.0.0.1:9000:9000", compose_text, "MinIO is not restricted to loopback")


if __name__ == "__main__":
    unittest.main()
