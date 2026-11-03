# MedGemma Application Package
from pathlib import Path

# Extend package search path to include apps/api/app so all submodules (core, db, api, etc.) resolve seamlessly
_api_app = Path(__file__).resolve().parent.parent / "apps" / "api" / "app"
if _api_app.exists() and str(_api_app) not in __path__:
    __path__.append(str(_api_app))
