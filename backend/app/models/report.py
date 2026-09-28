"""Report models.

A report is a JSON projection of a conversion result. It contains only fields
that actually exist - no invented metrics.
"""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field

from app.models.conversion import ConversionIssue, ConversionResult, ValidationStage


class ConversionReport(BaseModel):
    """A downloadable, JSON-serialisable conversion report."""

    report_type: str = "configuration-conversion"
    report_id: str
    generated_at: str
    source_platform: str
    target_platform: str
    status: str
    summary: dict
    converted_configuration: str
    warnings: list[ConversionIssue] = Field(default_factory=list)
    unsupported_commands: list[dict] = Field(default_factory=list)
    requires_review: list[dict] = Field(default_factory=list)
    validation: dict = Field(default_factory=dict)


def build_report(result: ConversionResult) -> ConversionReport:
    """Project a :class:`ConversionResult` into a report."""
    unsupported = [
        {
            "source_command": issue.source_command,
            "concept": issue.concept,
            "detail": issue.detail,
        }
        for issue in result.warnings
        if issue.status == "unsupported" and issue.source_command
    ]
    review = [
        {
            "source_command": issue.source_command,
            "concept": issue.concept,
            "detail": issue.detail,
        }
        for issue in result.warnings
        if issue.status == "requires_review"
    ]
    stages = result.validation
    return ConversionReport(
        report_id=result.id,
        generated_at=result.created_at,
        source_platform=result.source_platform,
        target_platform=result.target_platform,
        status=result.status,
        summary={
            "commands_processed": result.commands_processed,
            "commands_converted": result.commands_converted,
            "requires_review": result.requires_review,
            "unsupported": result.unsupported,
            "warning_count": len(result.warnings),
        },
        converted_configuration=result.converted_configuration,
        warnings=result.warnings,
        unsupported_commands=unsupported,
        requires_review=review,
        validation={
            "status": _status_from_stages(stages),
            "stages": [stage.model_dump() for stage in stages],
        },
    )


def _status_from_stages(stages: list[ValidationStage]) -> str:
    if not stages:
        return "not_run"
    if any(stage.status == "fail" for stage in stages):
        return "invalid"
    if any(stage.status == "warn" for stage in stages):
        return "valid_with_review"
    return "valid"


class StoredReport(BaseModel):
    report: ConversionReport
    created_at: str
    filename: str = "configuration-report.json"
    conversion_id: Optional[str] = None
