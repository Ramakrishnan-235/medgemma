from contextlib import asynccontextmanager
from typing import AsyncGenerator
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    # Startup logic
    yield
    # Shutdown logic


app = FastAPI(
    title="MedGemma API",
    description="Clinical intelligence workspace and multi-modal case analysis API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
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
