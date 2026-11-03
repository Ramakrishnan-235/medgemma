"""API v1 Endpoints"""
from fastapi import APIRouter

from app.api.v1.cases import router as cases_router
from app.api.v1.ehr import router as ehr_router
from app.api.v1.imaging import router as imaging_router
from app.api.v1.reports import router as reports_router
from app.api.v1.runs import router as runs_router
from app.api.v1.uploads import router as uploads_router
from app.api.v1.volumetric import router as volumetric_router, ct_router
from app.workers.recovery import router as recovery_router

api_v1_router = APIRouter(prefix="/v1")
api_v1_router.include_router(cases_router)
api_v1_router.include_router(uploads_router)
api_v1_router.include_router(runs_router)
api_v1_router.include_router(ehr_router)
api_v1_router.include_router(imaging_router)
api_v1_router.include_router(volumetric_router)
api_v1_router.include_router(ct_router)
api_v1_router.include_router(reports_router)
api_v1_router.include_router(recovery_router)

__all__ = [
    "api_v1_router",
    "cases_router",
    "uploads_router",
    "runs_router",
    "ehr_router",
    "imaging_router",
    "volumetric_router",
    "ct_router",
    "reports_router",
    "recovery_router",
]

