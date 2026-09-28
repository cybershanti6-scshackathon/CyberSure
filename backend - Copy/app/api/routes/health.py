"""Health endpoint."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from app.converters import available_platforms
from app.core.config import settings
from app.models.device import PlatformId

router = APIRouter()


@router.get("/health", tags=["health"])
def health() -> dict[str, Any]:
    """Liveness plus a summary of what the engine can currently do."""
    return {
        "status": "ok",
        "service": settings.app_name,
        "version": settings.version,
        "platforms_supported": len(available_platforms()),
        "platform_ids": [platform.value for platform in available_platforms()],
        "engine": "normalized-ir",
        "report_formats": ["json"],
    }


@router.get("/health/ready", tags=["health"])
def ready() -> dict[str, Any]:
    """Readiness check: every registered platform must be constructible."""
    from app.converters import get_converter

    failures: dict[str, str] = {}
    for platform in available_platforms():
        try:
            get_converter(platform)
        except Exception as error:  # pragma: no cover - defensive
            failures[platform.value] = str(error)
    return {
        "ready": not failures,
        "checked": len(available_platforms()),
        "failures": failures,
    }
