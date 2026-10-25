import os
from typing import Optional

def _safe_int(val: Optional[str], default: int = 1) -> int:
    if val is None or not str(val).strip():
        return default
    try:
        return int(str(val).strip())
    except ValueError:
        return default


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
                            val = val.strip().strip("'\"")
                            if key and key not in os.environ:
                                os.environ[key] = val
            except Exception:
                pass
            break


try:
    from pydantic_settings import BaseSettings, SettingsConfigDict

    class Settings(BaseSettings):
        model_config = SettingsConfigDict(
            env_file=(".env", "../.env", "../../.env"),
            env_file_encoding="utf-8",
            extra="ignore",
        )

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

        JWKS_URL: str = "http://web:3000/api/auth/jwks"
        JWT_ISSUER: str = "http://localhost:3000"
        JWT_AUDIENCE: str = "medgemma-api"

        MEDGEMMA_MODE: str = "local_4bit"
        MEDGEMMA_CHECKPOINT: str = "google/medgemma-1.5-4b-it"
        MEDGEMMA_PROCESSOR_VERSION: str = "1.5.0-896px"
        MEDGEMMA_SERVICE_URL: str = "http://gpu-service:8080"
        MEDGEMMA_MAX_CONCURRENCY: int = 1
        HF_TOKEN: Optional[str] = None

    settings = Settings()

except ImportError:
    _load_env_fallback()

    class FallbackSettings:
        POSTGRES_USER: str = os.getenv("POSTGRES_USER", "medgemma")
        POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "medgemma_dev_secret")
        POSTGRES_DB: str = os.getenv("POSTGRES_DB", "medgemma_workspace")
        DATABASE_URL: str = os.getenv(
            "DATABASE_URL",
            "postgresql+asyncpg://medgemma:medgemma_dev_secret@postgres:5432/medgemma_workspace",
        )

        REDIS_URL: str = os.getenv("REDIS_URL", "redis://redis:6379/0")

        S3_ENDPOINT_URL: str = os.getenv("S3_ENDPOINT_URL", "http://minio:9000")
        S3_PUBLIC_ENDPOINT_URL: str = os.getenv("S3_PUBLIC_ENDPOINT_URL", "http://localhost:9000")
        S3_ACCESS_KEY: str = os.getenv("S3_ACCESS_KEY", "minioadmin")
        S3_SECRET_KEY: str = os.getenv("S3_SECRET_KEY", "minioadmin_secret")
        S3_BUCKET_NAME: str = os.getenv("S3_BUCKET_NAME", "clinical-cases")

        JWKS_URL: str = os.getenv("JWKS_URL", "http://web:3000/api/auth/jwks")
        JWT_ISSUER: str = os.getenv("JWT_ISSUER", "http://localhost:3000")
        JWT_AUDIENCE: str = os.getenv("JWT_AUDIENCE", "medgemma-api")

        MEDGEMMA_MODE: str = os.getenv("MEDGEMMA_MODE", "local_4bit")
        MEDGEMMA_CHECKPOINT: str = os.getenv("MEDGEMMA_CHECKPOINT", "google/medgemma-1.5-4b-it")
        MEDGEMMA_PROCESSOR_VERSION: str = os.getenv("MEDGEMMA_PROCESSOR_VERSION", "1.5.0-896px")
        MEDGEMMA_SERVICE_URL: str = os.getenv("MEDGEMMA_SERVICE_URL", "http://gpu-service:8080")
        MEDGEMMA_MAX_CONCURRENCY: int = _safe_int(os.getenv("MEDGEMMA_MAX_CONCURRENCY"), default=1)
        HF_TOKEN: Optional[str] = os.getenv("HF_TOKEN")

    settings = FallbackSettings()  # type: ignore
