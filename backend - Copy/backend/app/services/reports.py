"""In-memory store for generated conversion reports.

Reports live for the lifetime of the process; nothing is written to disk and no
external service is contacted. This mirrors the prototype's existing
"session-only history" behaviour.
"""

from __future__ import annotations

from collections import OrderedDict
from typing import Optional

from app.core.config import settings
from app.models.conversion import ConversionResult
from app.models.report import ConversionReport, StoredReport, build_report

_REPORTS: "OrderedDict[str, StoredReport]" = OrderedDict()


def store(result: ConversionResult) -> StoredReport:
    report = build_report(result)
    stored = StoredReport(
        report=report,
        created_at=report.generated_at,
        conversion_id=result.id,
    )
    _REPORTS[stored.report.report_id] = stored
    while len(_REPORTS) > settings.max_reports:
        _REPORTS.popitem(last=False)
    return stored


def get(report_id: str) -> Optional[StoredReport]:
    return _REPORTS.get(report_id)


def list_reports() -> list[StoredReport]:
    return list(_REPORTS.values())


def clear() -> None:
    _REPORTS.clear()
