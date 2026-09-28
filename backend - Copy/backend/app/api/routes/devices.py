"""Device / platform catalogue endpoint.

The frontend dropdowns read their options from here, so adding a platform to
the backend is enough to make it selectable in the UI.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException

from app.converters import get_converter
from app.models.device import PlatformId, list_platforms, platform_info, resolve_platform

router = APIRouter()


def _describe(platform_id: PlatformId) -> dict[str, Any]:
    info = platform_info(platform_id)
    converter = get_converter(platform_id)
    return {
        "id": info.id,
        "name": info.name,
        "vendor": info.vendor,
        "family": info.family,
        "cli_label": info.cli_label,
        "file_extension": info.file_extension,
        "description": info.description,
        "capabilities": converter.capabilities(),
    }


@router.get("/devices", tags=["devices"])
def list_devices() -> dict[str, Any]:
    """Every platform the converter can parse and/or render."""
    return {
        "count": len(list_platforms()),
        "platforms": [_describe(platform) for platform in list_platforms()],
    }


@router.get("/platforms", tags=["devices"], include_in_schema=False)
def list_platforms_alias() -> dict[str, Any]:
    return list_devices()


@router.get("/devices/{platform_id}", tags=["devices"])
def get_device(platform_id: str) -> dict[str, Any]:
    resolved = resolve_platform(platform_id)
    if resolved is None:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown platform '{platform_id}'.",
        )
    return _describe(resolved)
