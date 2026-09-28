"""Report endpoints.

Reports are served as JSON only - this prototype does not produce DOC, DOCX
or binary PDF files.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from app.converters import get_converter
from app.core.config import settings
from app.models.conversion import ConversionRequest, ConversionResult
from app.models.device import resolve_platform
from app.services import reports as report_store
from app.services.converter import ConversionError, convert

router = APIRouter()


@router.get("/reports", tags=["reports"])
def list_reports() -> dict[str, Any]:
    stored = report_store.list_reports()
    return {
        "count": len(stored),
        "reports": [
            {
                "report_id": entry.report.report_id,
                "conversion_id": entry.conversion_id,
                "generated_at": entry.created_at,
                "source_platform": entry.report.source_platform,
                "target_platform": entry.report.target_platform,
                "status": entry.report.status,
                "filename": entry.filename,
            }
            for entry in stored
        ],
    }


@router.get("/reports/{report_id}", tags=["reports"])
def get_report(report_id: str) -> dict[str, Any]:
    stored = report_store.get(report_id)
    if stored is None:
        raise HTTPException(status_code=404, detail=f"No report found for '{report_id}'.")
    return stored.report.model_dump()


@router.get("/reports/{report_id}/download", tags=["reports"])
def download_report(report_id: str) -> JSONResponse:
    """Download the report as ``configuration-report.json``."""
    stored = report_store.get(report_id)
    if stored is None:
        raise HTTPException(status_code=404, detail=f"No report found for '{report_id}'.")
    return JSONResponse(
        content=stored.report.model_dump(),
        headers={
            "Content-Disposition": f'attachment; filename="{stored.filename}"',
            "X-CYBERSURE-Report-Format": "json",
        },
    )


@router.post("/reports/configuration", tags=["reports"])
def create_configuration_report(request: ConversionRequest) -> dict[str, Any]:
    """Run a conversion and return its report in one call."""
    source = resolve_platform(request.source_platform)
    target = resolve_platform(request.target_platform)
    if source is None or target is None:
        raise HTTPException(
            status_code=422,
            detail="Unknown platform. Call GET /api/v1/devices for supported ids.",
        )
    try:
        result: ConversionResult = convert(
            source, target, request.configuration, run_validation=request.run_validation
        )
    except ConversionError as error:
        raise HTTPException(status_code=error.status_code, detail=error.message) from error
    stored = report_store.store(result)
    return stored.report.model_dump()


@router.get("/platforms/{platform_id}/samples", tags=["reports"], include_in_schema=False)
def platform_sample(platform_id: str) -> dict[str, Any]:
    """Echo a round-trip conversion capability summary for a platform.

    Used by the frontend to confirm the backend understands a platform before
    the user pastes anything.
    """
    platform = resolve_platform(platform_id)
    if platform is None:
        raise HTTPException(status_code=404, detail=f"Unknown platform '{platform_id}'.")
    converter = get_converter(platform)
    return {
        "platform": platform.value,
        "capabilities": converter.capabilities(),
        "accepts_upload_extensions": sorted(settings.allowed_upload_extensions),
    }
