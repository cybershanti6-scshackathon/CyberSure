"""Cisco ASA converter.

ASA shares Cisco block syntax but models several concepts differently: NAT is
`nat (inside,outside) ...`, access lists are named (`access-list NAME extended
permit ...`), interfaces carry a `security-level`, and management settings
apply per security level rather than globally. The converter therefore parses
ASA's variants in addition to the shared forms and reports the constructs it
cannot carry across.
"""

from __future__ import annotations

import re

from app.converters.base import ParseResult
from app.converters.cisco_like import CiscoLikeConverter, CiscoLikeParser
from app.models.device import PlatformId
from app.models.network import (
    NatEntry,
    NetworkConfig,
    RenderIssue,
)

#: ASA access-list definition: ``access-list NAME extended permit ip A A B B``
ASA_ACCESS_LIST_RE = re.compile(
    r"^access-list\s+(\S+)\s+(standard|extended|remark)\s+(.*)$", re.I
)
ASA_NAT_RE = re.compile(
    r"^nat\s+\(\s*(\S+?)\s*,\s*(\S+?)\s*\)\s+(source|destination)\s+(.*)$", re.I
)
ASA_SECURITY_LEVEL_RE = re.compile(r"^security-level\s+(\d+)\s*$", re.I)
ASA_NAMEIF_RE = re.compile(r"^nameif\s+(\S+)\s*$", re.I)


class CiscoASAConverter(CiscoLikeConverter):
    platform = PlatformId.CISCO_ASA
    vlan_name_style = "none"
    supports_ospf = False
    supports_bgp = False
    supports_snmp = False
    supports_users = False
    supports_banner = False

    def parse(self, text: str) -> ParseResult:
        result = super().parse(text)
        self._parse_asa_specific(result.config, text)
        return result

    def _parse_asa_specific(self, model: NetworkConfig, text: str) -> None:
        """Second pass for ASA-only syntax the shared parser skipped."""
        drop: set[int] = set()
        for unparsed in list(model.unparsed):
            line = unparsed.raw
            match = ASA_ACCESS_LIST_RE.match(line)
            if match:
                name, kind, body = match.group(1), match.group(2).lower(), match.group(3)
                if kind == "remark":
                    model.partial.append(line)
                    drop.add(unparsed.line)
                    continue
                if body.lower().startswith(("permit", "deny")):
                    tokens = body.split()
                    action = tokens[0].lower()
                    rest = " ".join(tokens[1:])
                    entry = CiscoLikeParser._build_acl_entry(
                        name, kind, None, action, rest, line, unparsed.line
                    )
                    if entry is not None:
                        model.acls.append(entry)
                    drop.add(unparsed.line)
                    continue
                model.partial.append(line)
                drop.add(unparsed.line)

            match = ASA_NAT_RE.match(line)
            if match:
                inside, _outside, kind, body = (
                    match.group(1),
                    match.group(2),
                    match.group(3).lower(),
                    match.group(4),
                )
                if kind == "source":
                    tokens = body.split()
                    translation = tokens[0] if tokens else ""
                    overload = "overload" in tokens
                    inside_source = " ".join(tokens[1:]) or None
                    model.nat.append(
                        NatEntry(
                            nat_type="source",
                            inside_source=inside_source,
                            translation=translation,
                            overload=overload,
                            interface=None,
                            raw=line,
                        )
                    )
                    drop.add(unparsed.line)

        if drop:
            model.unparsed = [
                entry for entry in model.unparsed if entry.line not in drop
            ]

    def render(self, model: NetworkConfig) -> RenderResult:
        result = super().render(model)

        # ASA names its ACLs differently from IOS.
        if model.acls:
            result.issues.append(
                RenderIssue(
                    status="requires_review",
                    concept="Access control lists",
                    detail=(
                        "ASA access lists are named objects with an implicit deny. Review "
                        "the ordering and the implicit deny-all on the target."
                    ),
                )
            )
        if model.nat:
            result.issues.append(
                RenderIssue(
                    status="requires_review",
                    concept="NAT",
                    detail=(
                        "ASA NAT is bound to interface security levels. Confirm the "
                        "inside/outside interface pairs after import."
                    ),
                )
            )
        if model.syslog_hosts:
            result.issues.append(
                RenderIssue(
                    status="requires_review",
                    concept="Syslog",
                    detail="ASA logging host is set with `logging host <ip> <interface>`; verify the egress interface.",
                )
            )
        return result
