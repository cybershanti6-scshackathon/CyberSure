"""Converter base classes.

A converter has two halves:

* a **parser** turning platform syntax into the normalized :class:`NetworkConfig`
* a **renderer** turning a :class:`NetworkConfig` back into platform syntax

Renderers never guess. Every construct they cannot express faithfully is
recorded as a :class:`RenderIssue` with status ``unsupported`` or
``requires_review`` and the originating command, so the caller can see exactly
what was and was not translated.
"""

from __future__ import annotations

import re
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Iterable, Optional

from app.models.device import CliFamily, PlatformId
from app.models.network import (
    AclEntry,
    Interface,
    NetworkConfig,
    RenderIssue,
    UnparsedCommand,
)

#: Concepts a renderer may claim to support.
CAPABILITY_NAMES = [
    "hostname",
    "domain_name",
    "interfaces",
    "interface_description",
    "ipv4_addressing",
    "mtu",
    "interface_admin_state",
    "vlan",
    "switchport",
    "static_routes",
    "ospf",
    "bgp",
    "acl",
    "nat",
    "dns",
    "ntp",
    "syslog",
    "ssh",
    "telnet",
    "snmp",
    "users",
    "banner",
    "features",
]


@dataclass
class ParseResult:
    """Output of a parser."""

    config: NetworkConfig
    #: Lines the parser deliberately skipped (comments, blank lines, separators).
    ignored_lines: int = 0


@dataclass
class RenderResult:
    """Output of a renderer."""

    config: str
    issues: list[RenderIssue] = field(default_factory=list)
    #: Number of IR constructs that were emitted successfully.
    translated: int = 0

    def unsupported(self) -> list[RenderIssue]:
        return [issue for issue in self.issues if issue.status == "unsupported"]

    def needs_review(self) -> list[RenderIssue]:
        return [issue for issue in self.issues if issue.status == "requires_review"]


class BaseConverter(ABC):
    """Interface every platform converter implements."""

    platform: PlatformId
    family: CliFamily

    @abstractmethod
    def parse(self, text: str) -> ParseResult:
        """Parse platform configuration into the normalized model."""

    @abstractmethod
    def render(self, model: NetworkConfig) -> RenderResult:
        """Render the normalized model into platform syntax."""

    def capabilities(self) -> list[str]:
        return list(CAPABILITY_NAMES)

    def supports(self, capability: str) -> bool:
        return capability in self.capabilities()

    def require(
        self,
        result: RenderResult,
        capability: str,
        concept: str,
        detail: str,
        source_command: Optional[str] = None,
    ) -> None:
        """Record an ``unsupported`` construct instead of inventing output."""
        result.issues.append(
            RenderIssue(
                status="unsupported",
                concept=concept,
                detail=detail,
                source_command=source_command,
            )
        )
        del capability  # documentation only; kept for call-site readability

    def review(
        self,
        result: RenderResult,
        concept: str,
        detail: str,
        source_command: Optional[str] = None,
    ) -> None:
        """Record a translation that exists but cannot be proven equivalent."""
        result.issues.append(
            RenderIssue(
                status="requires_review",
                concept=concept,
                detail=detail,
                source_command=source_command,
            )
        )


# --------------------------------------------------------------------------------------
# Shared helpers
# --------------------------------------------------------------------------------------


def strip_comment(line: str) -> tuple[str, bool]:
    """Split a line into ``(content, was_comment)`` for a given comment prefix."""
    stripped = line.strip()
    if not stripped:
        return "", False
    if stripped[0] in "!#/*":
        return "", True
    return line.rstrip(), False


def indent_of(line: str) -> int:
    return len(line) - len(line.lstrip())


def is_separator(line: str) -> bool:
    """``!``-only / ``#``-only separator lines."""
    return line.strip() in {"!", "#", "//", "end", "return", "exit"}


def merge_unparsed(model: NetworkConfig, entries: Iterable[UnparsedCommand]) -> None:
    for entry in entries:
        model.unparsed.append(entry)


def unparsed_from(model: NetworkConfig) -> list[UnparsedCommand]:
    return list(model.unparsed)


def upsert_interface(model: NetworkConfig, name: str) -> Interface:
    """Fetch or create an interface by (case-insensitive) name."""
    existing = model.interface(name)
    if existing is not None:
        return existing
    created = Interface(name=name)
    model.interfaces.append(created)
    return created


def add_acl_entry(model: NetworkConfig, entry: AclEntry) -> None:
    for existing in model.acls:
        if existing.acl_name.lower() == entry.acl_name.lower() and existing.raw == entry.raw:
            return
    model.acls.append(entry)


NUMBERED_ACL_NAME = re.compile(r"^\d{1,3}$")
