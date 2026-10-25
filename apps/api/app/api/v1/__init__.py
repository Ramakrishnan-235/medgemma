"""API v1 Endpoints"""
from fastapi import APIRouter

from app.api.v1.runs import router as runs_router
from app.api.v1.uploads import router as uploads_router

api_v1_router = APIRouter(prefix="/v1")
api_v1_router.include_router(uploads_router)
api_v1_router.include_router(runs_router)

__all__ = ["api_v1_router", "uploads_router", "runs_router"]
