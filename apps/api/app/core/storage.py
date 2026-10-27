import hashlib
from dataclasses import dataclass
import logging
from typing import Literal

import boto3
from botocore.client import Config
from botocore.exceptions import ClientError
from fastapi import HTTPException, status

from app.core.config import settings

logger = logging.getLogger("storage")
FileKind = Literal["pdf", "dicom", "image_png", "image_jpeg", "ehr_note"]


@dataclass(frozen=True)
class VerifiedObjectInfo:
    byte_size: int
    sha256_hex: str
    detected_kind: FileKind


class PrivateStorageAdapter:
    def __init__(self) -> None:
        s3_config = Config(signature_version="s3v4", s3={"addressing_style": "path"})
        self.internal_s3 = boto3.client(
            "s3",
            endpoint_url=settings.S3_ENDPOINT_URL,
            aws_access_key_id=settings.S3_ACCESS_KEY,
            aws_secret_access_key=settings.S3_SECRET_KEY,
            config=s3_config,
            region_name="us-east-1",
        )
        self.public_signer_s3 = boto3.client(
            "s3",
            endpoint_url=settings.S3_PUBLIC_ENDPOINT_URL,
            aws_access_key_id=settings.S3_ACCESS_KEY,
            aws_secret_access_key=settings.S3_SECRET_KEY,
            config=s3_config,
            region_name="us-east-1",
        )
        self.bucket = settings.S3_BUCKET_NAME

    def ensure_bucket_exists(self) -> None:
        try:
            self.internal_s3.head_bucket(Bucket=self.bucket)
        except ClientError:
            try:
                self.internal_s3.create_bucket(Bucket=self.bucket)
                logger.info("Created S3 bucket '%s'", self.bucket)
            except ClientError as exc:
                logger.warning("Could not create S3 bucket '%s': %s", self.bucket, exc)

    def create_presigned_put_url(
        self, storage_key: str, mime_type: str, expires_in: int = 900
    ) -> str:
        return self.public_signer_s3.generate_presigned_url(
            ClientMethod="put_object",
            Params={
                "Bucket": self.bucket,
                "Key": storage_key,
                "ContentType": mime_type,
            },
            ExpiresIn=expires_in,
        )

    def create_presigned_get_url(
        self, storage_key: str, expires_in: int = 900
    ) -> str:
        return self.public_signer_s3.generate_presigned_url(
            ClientMethod="get_object",
            Params={"Bucket": self.bucket, "Key": storage_key},
            ExpiresIn=expires_in,
        )

    def get_object_bytes(self, storage_key: str) -> bytes:
        resp = self.internal_s3.get_object(Bucket=self.bucket, Key=storage_key)
        return resp["Body"].read()

    def delete_object(self, storage_key: str) -> None:
        try:
            self.internal_s3.delete_object(Bucket=self.bucket, Key=storage_key)
        except ClientError as exc:
            logger.warning("Failed to delete S3 object '%s': %s", storage_key, exc)

    def verify_uploaded_bytes(
        self,
        storage_key: str,
        expected_sha256: str,
        declared_kind: FileKind,
    ) -> VerifiedObjectInfo:
        """
        Streams the object in 64 KB chunks from private storage to verify:
        1. Exact SHA-256 integrity against the client's declared checksum.
        2. Magic header bytes (PDF, PNG, JPEG, DICOM preamble at offset 128).
        Removes invalid or corrupted files immediately upon validation failure.
        """
        try:
            resp = self.internal_s3.get_object(Bucket=self.bucket, Key=storage_key)
        except ClientError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded object not found in private storage.",
            ) from exc

        hasher = hashlib.sha256()
        header_buf = bytearray()
        total_bytes = 0

        for chunk in resp["Body"].iter_chunks(chunk_size=65536):
            if len(header_buf) < 256:
                needed = 256 - len(header_buf)
                header_buf.extend(chunk[:needed])
            hasher.update(chunk)
            total_bytes += len(chunk)

        actual_sha256 = hasher.hexdigest().lower()
        if actual_sha256 != expected_sha256.lower():
            self.delete_object(storage_key)
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"SHA-256 mismatch: expected {expected_sha256}, got {actual_sha256}",
            )

        header = bytes(header_buf)
        invalid_reason = None
        if declared_kind == "pdf" and not header.startswith(b"%PDF-"):
            invalid_reason = "Invalid PDF magic bytes."
        elif declared_kind == "image_png" and not header.startswith(b"\x89PNG\r\n\x1a\n"):
            invalid_reason = "Invalid PNG magic bytes."
        elif declared_kind == "image_jpeg" and not header.startswith(b"\xff\xd8\xff"):
            invalid_reason = "Invalid JPEG magic bytes."
        elif declared_kind == "dicom" and (len(header) < 132 or header[128:132] != b"DICM"):
            invalid_reason = "Invalid DICOM preamble (missing DICM at offset 128)."
        elif declared_kind == "ehr_note":
            if total_bytes > 5 * 1024 * 1024:
                invalid_reason = "EHR note exceeds maximum allowed size of 5 MB."
            else:
                try:
                    header.decode("utf-8")
                except UnicodeDecodeError:
                    try:
                        header[:-3].decode("utf-8")
                    except UnicodeDecodeError:
                        invalid_reason = "Invalid EHR note encoding: must be valid UTF-8 text."

        if invalid_reason:
            self.delete_object(storage_key)
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=invalid_reason)

        return VerifiedObjectInfo(
            byte_size=total_bytes,
            sha256_hex=actual_sha256,
            detected_kind=declared_kind,
        )


storage_adapter = PrivateStorageAdapter()
