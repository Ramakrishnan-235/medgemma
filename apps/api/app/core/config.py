import json
import logging
import os

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from typing import Optional


def _safe_int(val: Optional[str], default: int = 1) -> int:
    if val is None or not str(val).strip():
        return default
    try:
        return int(str(val).strip())
    except ValueError:
        return default


def _parse_cors_origins(raw: Optional[str]) -> list[str]:
    default_origins = [
        "http://localhost:3000",
        "http://localhost:80",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:80",
        "http://web:3000",
    ]
    if not raw or not raw.strip():
        return default_origins
    origins = [item.strip() for item in raw.split(",") if item.strip()]
    return origins if origins else default_origins


def _load_env_fallback() -> None:
    for candidate in [".env", "../.env", "../../.env"]:
        if os.path.isfile(candidate):
            try:
                with open(candidate, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith("#") and "=" in line:
                            key, _, val = line.partition("=")
                            key = key.strip()
                            if "#" in val and not (val.startswith('"') or val.startswith("'")):
                                val = val.split("#", 1)[0]
                            val = val.strip().strip("'\"")
                            if key and key not in os.environ:
                                os.environ[key] = val
            except OSError as exc:
                logging.getLogger(__name__).warning("Could not read environment file %s: %s", candidate, exc)
            break


class Settings(BaseModel):
    """One typed schema, whether started through uv, Docker, or a worker."""

    model_config = ConfigDict(extra="ignore")

    ENVIRONMENT: str = "development"
    POSTGRES_USER: str = "medgemma"
    POSTGRES_PASSWORD: str = "medgemma_dev_secret"
    POSTGRES_DB: str = "medgemma_workspace"
    DATABASE_URL: str = "postgresql+asyncpg://medgemma:medgemma_dev_secret@postgres:5432/medgemma_workspace"

    REDIS_URL: str = "redis://redis:6379/0"

    S3_ENDPOINT_URL: str = "http://minio:9000"
    S3_PUBLIC_ENDPOINT_URL: str = "http://localhost:9000"
    S3_ACCESS_KEY: str = "minioadmin"
    S3_SECRET_KEY: str = "minioadmin_secret"
    S3_BUCKET_NAME: str = "clinical-cases"
    S3_DICOM_BUCKET: str = "dicom-storage"
    S3_NIFTI_BUCKET: str = "nifti-volumes"
    S3_SEGMENTATION_BUCKET: str = "segmentations"

    JWKS_URL: str = "http://web:3000/api/auth/jwks"
    JWT_ISSUER: str = "http://localhost:3000"
    JWT_AUDIENCE: str = "medgemma-api"
    DEBUG_ALLOW_UNVERIFIED_JWT: bool = False
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://localhost:80",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:80",
        "http://web:3000",
    ]

    MEDGEMMA_MODE: str = "local_4bit"
    MEDGEMMA_CHECKPOINT: str = "google/medgemma-1.5-4b-it"
    MEDGEMMA_PROCESSOR_VERSION: str = "1.5.0-896px"
    MEDGEMMA_SERVICE_URL: str = "http://gpu-service:8080"
    MEDGEMMA_MAX_CONCURRENCY: int = Field(default=1, ge=1)
    HF_TOKEN: Optional[str] = None

    def __init__(self, **overrides):
        _load_env_fallback()
        values = {name: os.environ[name] for name in type(self).model_fields if name in os.environ}
        values.update(overrides)
        super().__init__(**values)

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_origins(cls, value):
        if isinstance(value, str):
            if value.lstrip().startswith("["):
                return json.loads(value)
            return _parse_cors_origins(value)
        return value

    @field_validator("MEDGEMMA_MAX_CONCURRENCY", mode="before")
    @classmethod
    def parse_concurrency(cls, value):
        return _safe_int(value, default=1)

    @field_validator("DEBUG_ALLOW_UNVERIFIED_JWT")
    @classmethod
    def validate_debug_allow_unverified_jwt(cls, value: bool, info) -> bool:
        env = (info.data.get("ENVIRONMENT") if info.data else None) or os.environ.get("ENVIRONMENT", "development")
        if value and str(env).strip().lower() in ("production", "prod", "staging"):
            raise ValueError(
                "DEBUG_ALLOW_UNVERIFIED_JWT cannot be enabled in production or staging environments"
            )
        return value

    @model_validator(mode="after")
    def validate_debug_jwt_model(self) -> "Settings":
        if self.DEBUG_ALLOW_UNVERIFIED_JWT and str(self.ENVIRONMENT).strip().lower() in (
            "production",
            "prod",
            "staging",
        ):
            raise ValueError(
                "DEBUG_ALLOW_UNVERIFIED_JWT cannot be enabled in production or staging environments"
            )
        return self


settings = Settings()
