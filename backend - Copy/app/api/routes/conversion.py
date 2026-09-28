"""Conversion, upload, detection and validation endpoints."""

from __future__ import annotations

import re
from typing import Any

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.core.config import settings
from app.converters import get_converter
from app.models.conversion import (
    ConversionRequest,
    ConversionResult,
    DetectionRequest,
    DetectionResult,
    ValidationRequest,
    ValidationResult,
    ValidationStage,
)
from app.models.device import resolve_platform
from app.services import reports as report_store
from app.services.converter import ConversionError, convert
from app.services.detector import detect_platform
from app.services.validator import overall_status, validate_rendered

router = APIRouter()

_FILENAME_SAFE = re.compile(r"[^A-Za-z0-9._-]+")


def _resolve(value: str, field: str):
    platform = resolve_platform(value)
    if platform is None:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Unknown {field} '{value}'. Call GET /api/v1/devices for the "
                f"supported platform ids."
            ),
        )
    return platform


@router.post("/conversions", response_model=ConversionResult, tags=["conversion"])
def create_conversion(request: ConversionRequest) -> ConversionResult:
    """Convert a configuration between any two supported platforms."""
    source = _resolve(request.source_platform, "source platform")
    target = _resolve(request.target_platform, "target platform")
    try:
        result = convert(
            source,
            target,
            request.configuration,
            run_validation=request.run_validation,
        )
    except ConversionError as error:
        raise HTTPException(status_code=error.status_code, detail=error.message) from error
    report_store.store(result)
    return result


@router.post("/conversions/upload", response_model=ConversionResult, tags=["conversion"])
async def upload_and_convert(
    file: UploadFile = File(..., description="Configuration file (.cfg/.conf/.txt/.rsc)"),
    source_platform: str = Form(..., description="Source platform id"),
    target_platform: str = Form(..., description="Target platform id"),
    run_validation: bool = Form(default=True, alias="validate"),
) -> ConversionResult:
    """Read a configuration file and convert it.

    The file is treated as untrusted text: it is size-limited, extension-checked
    and decoded as UTF-8 with a replacement fallback. It is never executed.
    """
    filename = file.filename or "upload"
    suffix = ("." + filename.rsplit(".", 1)[-1].lower()) if "." in filename else ""
    if suffix and suffix not in settings.allowed_upload_extensions:
        raise HTTPException(
            status_code=415,
            detail=(
                f"Unsupported file type '{suffix}'. Accepted: "
                + ", ".join(sorted(settings.allowed_upload_extensions))
            ),
        )

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")
    if len(raw) > settings.max_upload_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"The file exceeds the {settings.max_upload_bytes // 1024} KB upload limit.",
        )

    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        text = raw.decode("utf-8", errors="replace")

    source = _resolve(source_platform, "source platform")
    target = _resolve(target_platform, "target platform")
    try:
        result = convert(source, target, text, run_validation=run_validation)
    except ConversionError as error:
        raise HTTPException(status_code=error.status_code, detail=error.message) from error
    report_store.store(result)
    return result


@router.post("/detect", response_model=DetectionResult, tags=["conversion"])
def detect(request: DetectionRequest) -> DetectionResult:
    """Guess the source platform from recognisable syntax."""
    if not request.configuration.strip():
        raise HTTPException(status_code=400, detail="Configuration is empty.")
    outcome = detect_platform(request.configuration, request.platform)
    return DetectionResult(**outcome)


@router.post("/validate", response_model=ValidationResult, tags=["conversion"])
def validate(request: ValidationRequest) -> ValidationResult:
    """Parse a configuration for a platform and report structural validity."""
    platform = _resolve(request.platform, "platform")
    if not request.configuration.strip():
        raise HTTPException(status_code=400, detail="Configuration is empty.")

    converter = get_converter(platform)
    parse_result = converter.parse(request.configuration)
    model = parse_result.config

    if model.is_empty():
        return ValidationResult(
            platform=platform.value,
            valid=False,
            status="invalid",
            stages=[
                ValidationStage(
                    id="parse",
                    label="Parse",
                    status="fail",
                    detail=(
                        "No recognised configuration statements were found for "
                        f"{platform.value}."
                    ),
                )
            ],
            unparsed_count=len(model.unparsed),
        )

    # Round-trip through the renderer so validation inspects real output.
    render_result = converter.render(model)
    outcomes = validate_rendered(platform, render_result, model)
    status = overall_status(outcomes)
    stages = [
        ValidationStage(id=o.id, label=o.label, status=o.status, detail=o.detail)
        for o in outcomes
    ]
    stages.insert(
        0,
        ValidationStage(
            id="parse",
            label="Parse",
            status="pass",
            detail=(
                f"{len(model.interfaces)} interfaces, {len(model.vlans)} VLANs, "
                f"{len(model.static_routes)} static routes recognised."
            ),
        ),
    )
    return ValidationResult(
        platform=platform.value,
        valid=status != "invalid",
        status=status,  # type: ignore[arg-type]
        stages=stages,
        unparsed_count=len(model.unparsed),
    )


@router.get("/conversions/{conversion_id}", tags=["conversion"])
def get_conversion(conversion_id: str) -> dict[str, Any]:
    """Look up the report generated for a conversion id."""
    stored = report_store.get(conversion_id)
    if stored is None:
        raise HTTPException(status_code=404, detail=f"No conversion found for '{conversion_id}'.")
    return stored.report.model_dump()
