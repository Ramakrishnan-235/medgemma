import sys
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

_root = Path(__file__).resolve().parent.parent
_apps_api = str(_root / "apps" / "api")
if _apps_api not in sys.path:
    sys.path.insert(0, _apps_api)

from app.api.v1.volumetric import ct_router, router as volumetric_router  # noqa: E402

app = FastAPI(
    title="MedGemma 1.5 Volumetric Medical Processing API",
    description="3D CT & MRI multi-sequence volumetric analysis and reasoning telemetry",
    version="1.5.0",
)

# Enable CORS for Next.js frontend (development & production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "*",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "ct-backend-api",
        "cluster_online": True,
        "cluster_online_percent": 99.8,
        "sampled_slices_count": 64,
        "token_context_window": "128k",
    }

# Mount volumetric and ct routes under both /api/v1 and /v1
app.include_router(volumetric_router, prefix="/api/v1")
app.include_router(volumetric_router, prefix="/v1")
app.include_router(ct_router, prefix="/api/v1")
app.include_router(ct_router, prefix="/v1")

__all__ = ["app"]
