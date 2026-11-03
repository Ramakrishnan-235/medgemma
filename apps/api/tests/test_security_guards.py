import hashlib
from unittest.mock import MagicMock, patch

import jwt
import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.core.config import Settings
from app.core.security import verify_better_auth_jwt
from app.core.storage import PrivateStorageAdapter


def test_settings_rejects_debug_unverified_jwt_in_production():
    for prod_env in ("production", "prod", "staging", "PRODUCTION", "Staging"):
        with pytest.raises(ValidationError) as exc_info:
            Settings(ENVIRONMENT=prod_env, DEBUG_ALLOW_UNVERIFIED_JWT=True)
        assert "DEBUG_ALLOW_UNVERIFIED_JWT cannot be enabled" in str(exc_info.value)

    # Allowed in development or test
    dev_settings = Settings(ENVIRONMENT="development", DEBUG_ALLOW_UNVERIFIED_JWT=True)
    assert dev_settings.DEBUG_ALLOW_UNVERIFIED_JWT is True

    # False is allowed in production
    prod_secure = Settings(ENVIRONMENT="production", DEBUG_ALLOW_UNVERIFIED_JWT=False)
    assert prod_secure.DEBUG_ALLOW_UNVERIFIED_JWT is False


@pytest.mark.asyncio
async def test_verify_better_auth_jwt_rejects_hs256():
    # Symmetric HMAC secret key (>= 32 bytes for SHA256)
    secret = "super-secret-hmac-key-longer-than-32-bytes!"
    payload = {
        "sub": "user-123",
        "workspace_id": "ws-456",
        "iss": "http://localhost:3000",
        "aud": "medgemma-api",
    }
    # Create an HS256 token
    hs256_token = jwt.encode(payload, secret, algorithm="HS256")

    # Mock PyJWKClient to return a key object
    mock_signing_key = MagicMock()
    mock_signing_key.key = secret

    with patch("jwt.PyJWKClient") as mock_jwk_client_cls:
        mock_client = MagicMock()
        mock_client.get_signing_key_from_jwt.return_value = mock_signing_key
        mock_jwk_client_cls.return_value = mock_client

        with pytest.raises(HTTPException) as exc_info:
            await verify_better_auth_jwt(hs256_token)

        assert exc_info.value.status_code == 401
        assert "signature verification failed" in exc_info.value.detail.lower()


@pytest.mark.asyncio
async def test_verify_better_auth_jwt_missing_token_or_claims():
    with pytest.raises(HTTPException) as exc_empty:
        await verify_better_auth_jwt("")
    assert exc_empty.value.status_code == 401
    assert "Missing authentication token" in exc_empty.value.detail

    with pytest.raises(HTTPException) as exc_whitespace:
        await verify_better_auth_jwt("   ")
    assert exc_whitespace.value.status_code == 401


class MockStreamingBody:
    def __init__(self, data: bytes):
        self._data = data

    def iter_chunks(self, chunk_size: int = 65536):
        for i in range(0, len(self._data), chunk_size):
            yield self._data[i : i + chunk_size]


def test_storage_ehr_note_validation_success():
    adapter = PrivateStorageAdapter()
    note_content = "Patient code: PT-1234\nDiagnosis: Community-acquired pneumonia\nPlan: Amoxicillin 500mg TID".encode("utf-8")
    sha256 = hashlib.sha256(note_content).hexdigest()

    mock_s3 = MagicMock()
    mock_s3.get_object.return_value = {"Body": MockStreamingBody(note_content)}
    adapter.internal_s3 = mock_s3

    info = adapter.verify_uploaded_bytes(
        storage_key="test/ehr_note.txt",
        expected_sha256=sha256,
        declared_kind="ehr_note",
    )
    assert info.byte_size == len(note_content)
    assert info.detected_kind == "ehr_note"


def test_storage_ehr_note_validation_rejects_non_utf8():
    adapter = PrivateStorageAdapter()
    invalid_bytes = b"\x80\xff\xfe\x00\xaa\xbb\xcc"
    sha256 = hashlib.sha256(invalid_bytes).hexdigest()

    mock_s3 = MagicMock()
    mock_s3.get_object.return_value = {"Body": MockStreamingBody(invalid_bytes)}
    mock_s3.delete_object = MagicMock()
    adapter.internal_s3 = mock_s3

    with pytest.raises(HTTPException) as exc_info:
        adapter.verify_uploaded_bytes(
            storage_key="test/corrupt_note.bin",
            expected_sha256=sha256,
            declared_kind="ehr_note",
        )
    assert exc_info.value.status_code == 422
    assert "UTF-8" in exc_info.value.detail
    mock_s3.delete_object.assert_called_once()


def test_storage_ehr_note_validation_rejects_oversized_file():
    adapter = PrivateStorageAdapter()
    # 5 MB + 1 byte
    oversized = b"A" * (5 * 1024 * 1024 + 1)
    sha256 = hashlib.sha256(oversized).hexdigest()

    mock_s3 = MagicMock()
    mock_s3.get_object.return_value = {"Body": MockStreamingBody(oversized)}
    mock_s3.delete_object = MagicMock()
    adapter.internal_s3 = mock_s3

    with pytest.raises(HTTPException) as exc_info:
        adapter.verify_uploaded_bytes(
            storage_key="test/huge_note.txt",
            expected_sha256=sha256,
            declared_kind="ehr_note",
        )
    assert exc_info.value.status_code == 422
    assert "exceeds maximum allowed size of 5 MB" in exc_info.value.detail
    mock_s3.delete_object.assert_called_once()
