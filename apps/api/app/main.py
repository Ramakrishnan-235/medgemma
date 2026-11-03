import asyncio
from contextlib import asynccontextmanager
import logging
from typing import AsyncGenerator
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db.session import engine

logger = logging.getLogger("uvicorn")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    # Startup: ensure S3 private storage bucket exists
    try:
        from app.core.storage import storage_adapter
        await asyncio.to_thread(storage_adapter.ensure_bucket_exists)
    except Exception as exc:
        logger.warning("Could not auto-verify S3 bucket on startup: %s", exc)

    yield

    # Shutdown: gracefully close PostgreSQL connection pool
    await engine.dispose()


app = FastAPI(
    title="MedGemma API",
    description="Clinical intelligence workspace and multi-modal case analysis API",
    version="0.1.0",
    lifespan=lifespan,
)

# Secure CORS configuration: explicit origins when allow_credentials=True
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
)


@app.get("/health")
@app.get("/api/health")
async def health_check() -> dict[str, str]:
    return {
        "status": "healthy",
        "service": "medgemma-api",
        "mode": settings.MEDGEMMA_MODE,
        "checkpoint": settings.MEDGEMMA_CHECKPOINT,
    }


@app.get("/api/v1/info")
async def system_info() -> dict[str, str]:
    return {
        "title": "MedGemma API",
        "version": "0.1.0",
        "processor_version": settings.MEDGEMMA_PROCESSOR_VERSION,
        "gpu_service_url": settings.MEDGEMMA_SERVICE_URL,
    }


from app.api.v1 import api_v1_router  # noqa: E402

# Standard /api/v1 routes documented in OpenAPI /docs
app.include_router(api_v1_router, prefix="/api")

# Direct /v1 routes for Caddy handle_path reverse proxy, excluded from schema to avoid duplicate operation IDs
app.include_router(api_v1_router, include_in_schema=False)
