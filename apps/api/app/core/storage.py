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
FileKind = Literal["pdf", "dicom", "image_png", "image_jpeg", "ehr_note", "nifti", "segmentation"]


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

    @property
    def all_buckets(self) -> list[str]:
        return [
            self.bucket,
            settings.S3_DICOM_BUCKET,
            settings.S3_NIFTI_BUCKET,
            settings.S3_SEGMENTATION_BUCKET,
        ]

    def ensure_bucket_exists(self, bucket_name: str | None = None) -> None:
        target_bucket = bucket_name or self.bucket
        try:
            self.internal_s3.head_bucket(Bucket=target_bucket)
        except ClientError:
            try:
                self.internal_s3.create_bucket(Bucket=target_bucket)
                logger.info("Created S3 bucket '%s'", target_bucket)
            except ClientError as exc:
                logger.warning("Could not create S3 bucket '%s': %s", target_bucket, exc)

    def ensure_buckets_exist(self) -> None:
        """Idempotently ensures all required medical imaging and case buckets exist."""
        for b in self.all_buckets:
            self.ensure_bucket_exists(b)

    def create_presigned_put_url(
        self, storage_key: str, mime_type: str, expires_in: int = 900, bucket_name: str | None = None
    ) -> str:
        target_bucket = bucket_name or self.bucket
        return self.public_signer_s3.generate_presigned_url(
            ClientMethod="put_object",
            Params={
                "Bucket": target_bucket,
                "Key": storage_key,
                "ContentType": mime_type,
            },
            ExpiresIn=expires_in,
        )

    def create_presigned_get_url(
        self, storage_key: str, expires_in: int = 900, bucket_name: str | None = None
    ) -> str:
        target_bucket = bucket_name or self.bucket
        return self.public_signer_s3.generate_presigned_url(
            ClientMethod="get_object",
            Params={"Bucket": target_bucket, "Key": storage_key},
            ExpiresIn=expires_in,
        )

    def put_object_bytes(
        self, storage_key: str, data: bytes, mime_type: str = "application/octet-stream", bucket_name: str | None = None
    ) -> None:
        target_bucket = bucket_name or self.bucket
        self.internal_s3.put_object(
            Bucket=target_bucket,
            Key=storage_key,
            Body=data,
            ContentType=mime_type,
        )

    def get_object_bytes(self, storage_key: str, bucket_name: str | None = None) -> bytes:
        target_bucket = bucket_name or self.bucket
        resp = self.internal_s3.get_object(Bucket=target_bucket, Key=storage_key)
        return resp["Body"].read()

    def delete_object(self, storage_key: str, bucket_name: str | None = None) -> None:
        target_bucket = bucket_name or self.bucket
        try:
            self.internal_s3.delete_object(Bucket=target_bucket, Key=storage_key)
        except ClientError as exc:
            logger.warning("Failed to delete S3 object '%s' in '%s': %s", storage_key, target_bucket, exc)

    def verify_uploaded_bytes(
        self,
        storage_key: str,
        expected_sha256: str,
        declared_kind: FileKind,
        bucket_name: str | None = None,
    ) -> VerifiedObjectInfo:
        target_bucket = bucket_name or self.bucket
        try:
            resp = self.internal_s3.get_object(Bucket=target_bucket, Key=storage_key)
        except ClientError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded object not found in private storage.",
            ) from exc

        hasher = hashlib.sha256()
        header_buf = bytearray()
        total_bytes = 0

        for chunk in resp["Body"].iter_chunks(chunk_size=65536):
            if len(header_buf) < 352:
                needed = 352 - len(header_buf)
                header_buf.extend(chunk[:needed])
            hasher.update(chunk)
            total_bytes += len(chunk)

        actual_sha256 = hasher.hexdigest().lower()
        if actual_sha256 != expected_sha256.lower():
            self.delete_object(storage_key, bucket_name=target_bucket)
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
        elif declared_kind in ("nifti", "segmentation"):
            # Check gzip magic header (\x1f\x8b) for .nii.gz, or NIfTI-1 magic 'n+1\0' at offset 344 for uncompressed .nii
            is_gzip = header.startswith(b"\x1f\x8b")
            is_nii = len(header) >= 348 and header[344:348] in (b"n+1\0", b"ni1\0")
            if not (is_gzip or is_nii):
                invalid_reason = f"Invalid {declared_kind} file: must be gzip-compressed (.nii.gz) or NIfTI-1 (.nii)."
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
