"""Validation of a rendered target configuration.

Validation is deliberately structural: it checks that the generated text is
syntactically coherent for its platform, that the structures the target expects
are balanced, and that the required baseline elements are present. It never
claims a configuration is "safe" - only that it is structurally valid and
whether anything still needs a human decision.
"""

from __future__ import annotations

import re
from typing import Optional

from app.converters.base import RenderResult
from app.models.device import PlatformId
from app.models.network import NetworkConfig
from app.utils import addressing

#: Sub-commands that are only valid *inside* a block. Checked against indented
#: lines so that ` name USERS` under `vlan 10` is recognised as valid.
BLOCK_SUBCOMMANDS: list[str] = [
    "name", "description", "ip", "ipv6", "no", "switchport", "mtu", "shutdown",
    "exit", "vrf", "channel-group", "speed", "duplex", "negotiation", "standby",
    "encapsulation", "load-interval", "logging", "bandwidth", "delay",
    "access-class", "transport", "password", "exec-timeout", "login",
    "ntp", "snmp-server", "permit", "deny", "remark", "set", "config", "next",
    "edit", "default", "end", "exit-address-family", "redistribute",
]

#: Structural keywords that may legitimately start a top-level line, per family.
FAMILY_KEYWORDS: dict[str, list[str]] = {
    "cisco_like": [
        "hostname", "interface", "ip", "no", "line", "vlan", "banner", "end", "exit",
        "service", "logging", "ntp", "router", "network", "neighbor", "switchport",
        "description", "shutdown", "mtu", "username", "feature", "spanning-tree",
        "version", "snmp-server", "access-list", "channel-group", "vrf", "crypto",
        "aaa", "redistribute", "default", "ip access-group", "snmp-server host",
        "ip domain", "vrf definition", "boot", "license", "license-server",
        "archive", "asymmetric", "control-plane", "boot-end", "banner",
    ],
    "junos": ["set", "delete", "commit", "activate", "edit", "exit", "up", "replace"],
    "fortios": ["config", "edit", "next", "end", "set", "move", "rename", "purge", "leave"],
    "panos": ["set", "edit", "delete", "commit", "merge", "load", "default"],
    "routeros": ["/", "add", "set", "remove", "export", "import"],
    "huawei_vrp": [
        "sysname", "interface", "vlan", "ip", "quit", "return", "ntp", "service",
        "stelnet", "telnet", "description", "mtu", "port", "undo", "aaa", "ssh",
        "user-interface", "info-center", "router", "bgp", "ospf", "rule",
    ],
    "vyos": ["set", "delete", "configure", "commit", "exit", "top"],
}


def _family_of(platform: PlatformId) -> str:
    from app.models.device import PLATFORM_METADATA

    return PLATFORM_METADATA[platform].family


class ValidationOutcome:
    def __init__(
        self,
        id: str,
        label: str,
        status: str,
        detail: str,
    ) -> None:
        self.id = id
        self.label = label
        self.status = status  # pass | warn | fail
        self.detail = detail


def validate_rendered(
    platform: PlatformId,
    rendered: RenderResult,
    model: Optional[NetworkConfig] = None,
) -> list[ValidationOutcome]:
    """Return the validation stages for a rendered configuration."""
    family = _family_of(platform)
    keywords = FAMILY_KEYWORDS.get(family, [])
    text = rendered.config
    raw_lines = [line for line in text.splitlines() if line.strip()]
    body = [line.strip() for line in raw_lines if not line.strip().startswith(("#", "!"))]

    # ---- Syntax -------------------------------------------------------------
    # A line is valid if it is a known top-level keyword, or - when it is
    # indented - a known sub-command of the enclosing block.
    def starts_known(raw: str) -> bool:
        stripped = raw.strip()
        if not stripped:
            return True
        if any(stripped.startswith(keyword) for keyword in keywords):
            return True
        if raw[:1].isspace():
            return any(stripped.startswith(keyword) for keyword in BLOCK_SUBCOMMANDS)
        return False

    unknown = [line for line in raw_lines if not line.strip().startswith(("#", "!")) and not starts_known(line)]
    unbalanced = False
    unclosed_edits = False
    if family == "fortios":
        config_blocks = sum(1 for line in body if line.startswith("config "))
        ends = sum(1 for line in body if line == "end")
        unbalanced = config_blocks != ends
        edits = sum(1 for line in body if line.startswith("edit "))
        nexts = sum(1 for line in body if line == "next")
        unclosed_edits = edits != nexts
    if family == "cisco_like":
        # `interface`/`router` blocks must be closed with `exit` or `!`.
        openers = sum(1 for line in body if line.startswith(("interface ", "router ")))
        closers = sum(1 for line in body if line in {"exit", "!"})
        unclosed_edits = openers > closers

    syntax_ok = not unknown and not unbalanced and not unclosed_edits
    if syntax_ok:
        syntax_detail = f"All {len(body)} emitted lines use valid {platform.value} syntax."
    else:
        parts = []
        if unknown:
            parts.append(
                f"{len(unknown)} line(s) do not start with a {platform.value} keyword: "
                + ", ".join(repr(line.strip()[:40]) for line in unknown[:3])
            )
        if unbalanced:
            parts.append("configuration blocks are not balanced with `end`.")
        if unclosed_edits:
            parts.append("a block is missing its closing `exit`/`next`.")
        syntax_detail = " ".join(parts)

    syntax = ValidationOutcome("syntax", "Syntax Check", "pass" if syntax_ok else "fail", syntax_detail)

    # ---- Command mapping ----------------------------------------------------
    unsupported = len(rendered.unsupported())
    review = len(rendered.needs_review())
    total_issues = unsupported + review
    if total_issues == 0:
        mapping_status = "pass"
        mapping_detail = f"All {rendered.translated} translated constructs converted without flags."
    else:
        mapping_status = "warn"
        mapping_detail = (
            f"{rendered.translated} constructs converted, {review} need review, "
            f"{unsupported} could not be converted."
        )
    mapping = ValidationOutcome("mapping", "Command Mapping", mapping_status, mapping_detail)

    # ---- Required parameters -------------------------------------------------
    required_problems: list[str] = []
    if model is not None:
        if model.hostname and not re.search(r"hostname|host-name|sysname|set hostname", text, re.I):
            required_problems.append("No system hostname was produced.")
        wants_addressing = any(interface.addresses for interface in model.interfaces)
        if wants_addressing and not re.search(r"address|ip-address|\bip ", text, re.I):
            required_problems.append("Interface addressing was expected but none was produced.")
    if family == "junos" and not any(line.startswith("commit") for line in body):
        required_problems.append("A Junos candidate configuration must be committed to take effect.")
    required = ValidationOutcome(
        "parameters",
        "Required Parameters",
        "pass" if not required_problems else "warn",
        " ".join(required_problems) if required_problems
        else "Baseline elements required by the target platform are present.",
    )

    # ---- Potential conflicts --------------------------------------------------
    conflicts: list[str] = []
    for issue in rendered.unsupported()[:3]:
        conflicts.append(f"{issue.concept}: {issue.detail}")
    seen: dict[str, int] = {}
    for line in body:
        if line in {"end", "next", "commit", "configure", "exit", "quit", "return"}:
            continue
        if re.match(r"^(config|edit|interface|set system|set interfaces|set ip)\b", line):
            continue
        seen[line] = seen.get(line, 0) + 1
    duplicates = [line for line, count in seen.items() if count > 1]
    for line in duplicates[:3]:
        conflicts.append(f"Duplicate statement emitted: “{line}”.")
    if review:
        conflicts.append(f"{review} statement(s) were translated but flagged for manual review.")
    if conflicts:
        conflict = ValidationOutcome(
            "conflicts", "Potential Conflicts", "warn", " ".join(conflicts)
        )
    else:
        conflict = ValidationOutcome(
            "conflicts", "Potential Conflicts", "pass", "No conflicting or duplicate statements detected."
        )

    return [syntax, mapping, required, conflict]


def overall_status(outcomes: list[ValidationOutcome]) -> str:
    if any(outcome.status == "fail" for outcome in outcomes):
        return "invalid"
    if any(outcome.status == "warn" for outcome in outcomes):
        return "valid_with_review"
    return "valid"
