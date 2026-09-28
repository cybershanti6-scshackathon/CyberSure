"""Request and response models for the conversion API."""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

ConversionStatus = Literal["success", "partial", "requires_review", "unsupported", "invalid", "error"]
IssueStatus = Literal["unsupported", "requires_review"]


class ValidationStage(BaseModel):
    id: str
    label: str
    status: Literal["pass", "warn", "fail"]
    detail: str


class ConversionIssue(BaseModel):
    id: str
    status: IssueStatus
    concept: str
    detail: str
    source_command: Optional[str] = None
    original_line: Optional[str] = None


class LineMapping(BaseModel):
    line: int
    source: str
    target: list[str] = Field(default_factory=list)
    status: IssueStatus | Literal["converted"]
    rule_id: str
    rule_label: str
    note: Optional[str] = None


class ConversionResult(BaseModel):
    id: str
    source_platform: str
    target_platform: str
    status: ConversionStatus
    converted_configuration: str
    commands_processed: int
    commands_converted: int
    requires_review: int
    unsupported: int
    warnings: list[ConversionIssue] = Field(default_factory=list)
    validation: list[ValidationStage] = Field(default_factory=list)
    mapping: list[LineMapping] = Field(default_factory=list)
    ignored_lines: int = 0
    created_at: str


class ConversionRequest(BaseModel):
    source_platform: str = Field(..., description="Source platform id, e.g. cisco-nxos")
    target_platform: str = Field(..., description="Target platform id, e.g. juniper-junos")
    configuration: str = Field(..., description="Raw configuration text")
    # Named `run_validation` internally because `validate` shadows BaseModel's
    # own method; the wire format keeps the friendlier `validate` alias.
    run_validation: bool = Field(
        default=True,
        alias="validate",
        description="Run validation stages on the generated output",
    )
    model_config = {"populate_by_name": True}


class DetectionRequest(BaseModel):
    configuration: str
    #: Optional hint; when supplied and valid it wins over fingerprint detection.
    platform: Optional[str] = None


class DetectionResult(BaseModel):
    platform: Optional[str]
    confidence: float
    reasons: list[str]
    candidates: list[dict] = Field(default_factory=list)


class ValidationRequest(BaseModel):
    platform: str
    configuration: str


class ValidationResult(BaseModel):
    platform: str
    valid: bool
    status: Literal["valid", "valid_with_review", "invalid"]
    stages: list[ValidationStage]
    unparsed_count: int
