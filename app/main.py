import sys
from pathlib import Path

# Add apps/api to path if running from root context
_root = Path(__file__).resolve().parent.parent
_apps_api = str(_root / "apps" / "api")
if _apps_api not in sys.path:
    sys.path.insert(0, _apps_api)

try:
    from app.main import app
except Exception:
    from fastapi import FastAPI
    app = FastAPI(title="CT Backend & Medical Processing API", version="0.1.0")

    @app.get("/health")
    @app.get("/api/health")
    async def health_check():
        return {"status": "healthy", "service": "ct-backend-api"}

__all__ = ["app"]

