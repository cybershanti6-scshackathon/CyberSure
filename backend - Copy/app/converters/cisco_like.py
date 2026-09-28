"""Shared Cisco-style CLI parsing and rendering.

Covers the indent/block syntax shared by Cisco IOS, IOS-XE, NX-OS, ASA, Arista
EOS and Aruba AOS-CX. Platform modules subclass this and override the small
number of hooks where their dialect genuinely differs.
"""

from __future__ import annotations

import re
from typing import Optional

from app.converters.base import (
    BaseConverter,
    ParseResult,
    RenderResult,
    add_acl_entry,
    strip_comment,
    upsert_interface,
)
from app.models.device import CliFamily, PlatformId
from app.models.network import (
    AclApplication,
    AclEntry,
    Interface,
    NatEntry,
    NetworkConfig,
    NtpServer,
    OspfNetwork,
    OspfProcess,
    RenderIssue,
    SnmpCommunity,
    SshServer,
    StaticRoute,
    SyslogHost,
    TelnetServer,
    UnparsedCommand,
    UserAccount,
    Vlan,
    Address,
)
from app.utils import addressing

# --------------------------------------------------------------------------------------
# Parser
# --------------------------------------------------------------------------------------

_INTERFACE_RE = re.compile(r"^interface\s+(\S+)\s*$", re.I)
_IP_ADDRESS_RE = re.compile(
    r"^ip\s+address\s+(\d{1,3}(?:\.\d{1,3}){3})\s+(\d{1,3}(?:\.\d{1,3}){3})(\s+secondary)?\s*$",
    re.I,
)
_IPV6_ADDRESS_RE = re.compile(r"^ipv6\s+address\s+([0-9A-Fa-f:]+/\d{1,3})\s*$")
_IP_ROUTE_RE = re.compile(
    r"^ip\s+route\s+(\d{1,3}(?:\.\d{1,3}){3})\s+(\d{1,3}(?:\.\d{1,3}){3})"
    r"(?:\s+(\d{1,3}(?:\.\d{1,3}){3}))?(?:\s+(\d{1,3}))?\s*$"
)
_ACCESS_LIST_INLINE_RE = re.compile(
    r"^access-list\s+(\S+)\s+(permit|deny)\s+(.*)$", re.I
)
_NAT_INSIDE_RE = re.compile(
    r"^ip\s+nat\s+inside\s+source\s+(?:(?:list|static)\s+)?(\S+)(?:\s+(\S+))?(\s+overload)?\s*$",
    re.I,
)
_NAT_OUTSIDE_RE = re.compile(r"^ip\s+nat\s+outside\s*$", re.I)
_SNMP_RE = re.compile(r"^snmp-server\s+community\s+(\S+)\s+(ro|rw)(?:\s+(\S+))?\s*$", re.I)
_NTP_RE = re.compile(
    r"^ntp\s+server\s+(\S+)(?:\s+key\s+(\d+))?(?:\s+prefer)?\s*$", re.I
)
_LOGGING_HOST_RE = re.compile(
    r"^logging\s+host\s+(\S+)(?:\s+(\d+))?(?:\s+(facility-\S+))?\s*$", re.I
)
_LOGGING_BUFFERED_RE = re.compile(r"^logging\s+buffered\s+(\d+)\s+(\S+)\s*$", re.I)
_LOGGING_TRAP_RE = re.compile(r"^logging\s+trap\s+(\S+)\s*$", re.I)
_USERNAME_RE = re.compile(
    r"^username\s+(\S+)(?:\s+privilege\s+(\d+))?(?:\s+(secret|password)\s+\S+)?(?:\s+role\s+(\S+))?\s*$",
    re.I,
)
_IP_DNS_RE = re.compile(r"^ip\s+name-server\s+(.+)$", re.I)
_IP_DOMAIN_RE = re.compile(r"^ip\s+domain-name\s+(\S+)\s*$", re.I)
_IP_SSH_VERSION_RE = re.compile(r"^ip\s+ssh\s+version\s+(\d+)\s*$", re.I)
_IP_SSH_TIMEOUT_RE = re.compile(r"^ip\s+ssh\s+timeout\s+(\d+)\s*$", re.I)
_IP_SSH_RETRIES_RE = re.compile(r"^ip\s+ssh\s+authentication-retries\s+(\d+)\s*$", re.I)
_HOSTNAME_RE = re.compile(r"^hostname\s+(\S+)\s*$", re.I)
_VERSION_RE = re.compile(r"^version\s+(\S+)\s*$", re.I)
_VRF_FORWARDING_RE = re.compile(r"^vrf\s+forwarding\s+(\S+)\s*$", re.I)
_CHANNEL_GROUP_RE = re.compile(r"^channel-group\s+(\d+)\s+mode\s+(\S+)\s*$", re.I)
_SWPORT_ACCESS_RE = re.compile(r"^switchport\s+access\s+vlan\s+(\d+)\s*$", re.I)
_SWPORT_TRUNK_RE = re.compile(r"^switchport\s+trunk\s+allowed\s+vlan\s+(.+)$", re.I)
_SWPORT_MODE_RE = re.compile(r"^switchport\s+mode\s+(access|trunk)\s*$", re.I)
_ROUTER_OSPF_RE = re.compile(r"^router\s+ospf\s+(\S+)\s*$", re.I)
_ROUTER_BGP_RE = re.compile(r"^router\s+bgp\s+(\S+)\s*$", re.I)
_BGP_ROUTER_ID_RE = re.compile(r"^bgp\s+router-id\s+(\S+)\s*$", re.I)
_BGP_NEIGHBOR_RE = re.compile(r"^neighbor\s+(\S+)\s+remote-as\s+(\S+)\s*$", re.I)
_BGP_NETWORK_RE = re.compile(r"^network\s+(\S+)(?:\s+mask\s+(\S+))?\s*$", re.I)
_OSPF_NETWORK_RE = re.compile(r"^network\s+(\S+)\s+(\S+)\s+area\s+(\S+)\s*$", re.I)
_OSPF_ROUTER_ID_RE = re.compile(r"^router-id\s+(\S+)\s*$", re.I)
_ACCESS_LIST_BLOCK_RE = re.compile(
    r"^ip\s+access-list\s+(standard|extended)\s+(\S+)\s*$", re.I
)
_LINE_VTY_RE = re.compile(r"^line\s+(vty|console)\s*(.*)$", re.I)
_TRANSPORT_RE = re.compile(r"^transport\s+input\s+(.+)$", re.I)
_ACCESS_CLASS_RE = re.compile(r"^access-class\s+(\S+)\s+(in|out)\s*$", re.I)

#: Sub-commands we recognise but do not model; surfaced as `requires_review`.
CISCO_PARTIAL_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"^(no\s+)?logging\s+source-interface\b", re.I),
    re.compile(r"^(no\s+)?ip\s+tcp\s+path-mtu-discovery\b", re.I),
    re.compile(r"^(no\s+)?cdp\b", re.I),
    re.compile(r"^(no\s+)?lldp\b", re.I),
    re.compile(r"^(no\s+)?service\s+pad\b", re.I),
    re.compile(r"^(no\s+)?ip\s+http\b", re.I),
    re.compile(r"^(no\s+)?service\s+sequence-numbers\b", re.I),
]


class CiscoLikeParser:
    """Turns Cisco-style configuration text into a :class:`NetworkConfig`."""

    def __init__(self, converter: "CiscoLikeConverter") -> None:
        self.converter = converter

    def parse(self, text: str) -> ParseResult:
        model = NetworkConfig()
        lines = text.splitlines()
        ignored = 0

        current_interface: Optional[str] = None
        current_vlan: Optional[int] = None
        current_block: Optional[str] = None
        current_ospf = None
        current_bgp = None
        current_acl: Optional[tuple[str, str]] = None  # (kind, name)
        current_acl_header: Optional[str] = None
        current_line_block: Optional[str] = None
        banner_kind: Optional[str] = None
        banner_lines: list[str] = []

        index = 0
        total = len(lines)
        while index < total:
            raw = lines[index]
            line_number = index + 1

            # ---- multi-line banners ------------------------------------------
            if banner_kind is not None:
                if raw.strip().startswith("^C"):
                    text_value = " ".join(part for part in banner_lines if part).strip()
                    if banner_kind == "motd":
                        model.banner_motd = text_value or None
                    else:
                        model.banner_login = text_value or None
                    banner_kind = None
                    banner_lines = []
                else:
                    banner_lines.append(raw.strip())
                index += 1
                continue

            content, was_comment = strip_comment(raw)
            if was_comment:
                ignored += 1
                index += 1
                continue
            if not content.strip():
                ignored += 1
                index += 1
                continue

            line = content.strip()

            # ---- banner start -------------------------------------------------
            banner = re.match(r"^banner\s+(motd|login)\s+\^C\s*(.*)$", line, re.I)
            if banner:
                banner_kind = banner.group(1).lower()
                banner_lines = [banner.group(2)] if banner.group(2).strip() else []
                if len(banner_lines) == 0:
                    banner_lines = []
                index += 1
                continue

            if not self.converter.accept_line(line):
                model.unparsed.append(
                    UnparsedCommand(
                        raw=line,
                        line=line_number,
                        reason=f"Not valid {self.converter.platform_name} syntax",
                    )
                )
                index += 1
                continue

            if line.lower() in {"end", "exit", "return", "!", "#"}:
                current_interface = None
                current_vlan = None
                current_block = None
                current_ospf = None
                current_bgp = None
                current_acl = None
                current_line_block = None
                index += 1
                continue

            # ---- block openers ------------------------------------------------
            match = _INTERFACE_RE.match(line)
            if match:
                current_interface = match.group(1)
                current_block = "interface"
                current_vlan = None
                current_acl = None
                upsert_interface(model, current_interface)
                index += 1
                continue

            match = re.match(r"^vlan\s+(\d+)\s*$", line, re.I)
            if match:
                current_vlan = int(match.group(1))
                current_interface = None
                current_block = "vlan"
                if model.vlan(current_vlan) is None:
                    model.vlans.append(Vlan(vlan_id=current_vlan))
                index += 1
                continue

            match = re.match(r"^name\s+(\S+)\s*$", line, re.I)
            if match and current_block == "vlan" and current_vlan is not None:
                vlan = model.vlan(current_vlan)
                if vlan is not None:
                    vlan.name = match.group(1)
                index += 1
                continue

            match = _ROUTER_OSPF_RE.match(line)
            if match:
                current_ospf = OspfProcess(process_id=match.group(1))
                model.ospf.append(current_ospf)
                current_block = "ospf"
                current_interface = None
                current_bgp = None
                index += 1
                continue

            match = _ROUTER_BGP_RE.match(line)
            if match:
                from app.models.network import BgpProcess

                current_bgp = BgpProcess(asn=match.group(1))
                model.bgp.append(current_bgp)
                current_block = "bgp"
                current_interface = None
                current_ospf = None
                index += 1
                continue

            match = _ACCESS_LIST_BLOCK_RE.match(line)
            if match:
                current_acl = (match.group(1).lower(), match.group(2))
                current_acl_header = line
                current_block = "acl"
                current_interface = None
                index += 1
                continue

            match = _LINE_VTY_RE.match(line)
            if match:
                current_line_block = match.group(1).lower()
                current_block = "line"
                current_interface = None
                index += 1
                continue

            if line.lower().startswith("access-class") and current_block == "line":
                match = _ACCESS_CLASS_RE.match(line)
                if match:
                    model.acl_applications.append(
                        AclApplication(
                            target=current_line_block or "line",
                            direction=match.group(2).lower(),
                            acl_name=match.group(1),
                            source_command=line,
                        )
                    )
                    index += 1
                    continue

            # ---- interface sub-commands --------------------------------------
            if current_interface is not None:
                if self._parse_interface_line(model, current_interface, line):
                    index += 1
                    continue

            # ---- router-level sub-commands -----------------------------------
            if current_ospf is not None:
                match = _OSPF_ROUTER_ID_RE.match(line)
                if match:
                    current_ospf.router_id = match.group(1)
                    index += 1
                    continue
                match = _OSPF_NETWORK_RE.match(line)
                if match:
                    address, mask, area = match.group(1), match.group(2), match.group(3)
                    prefix = addressing.mask_to_prefix(mask)
                    current_ospf.networks.append(
                        OspfNetwork(prefix=f"{address}/{prefix}", area=area)
                    )
                    index += 1
                    continue

            if current_bgp is not None:
                match = _BGP_ROUTER_ID_RE.match(line)
                if match:
                    current_bgp.router_id = match.group(1)
                    index += 1
                    continue
                match = _BGP_NEIGHBOR_RE.match(line)
                if match:
                    current_bgp.neighbors.append(
                        BgpNeighbor(address=match.group(1), remote_as=match.group(2))
                    )
                    index += 1
                    continue
                match = _BGP_NETWORK_RE.match(line)
                if match:
                    address = match.group(1)
                    mask = match.group(2) or "255.255.255.255"
                    prefix = addressing.mask_to_prefix(mask)
                    current_bgp.networks.append(f"{address}/{prefix}")
                    index += 1
                    continue

            # ---- ACL block bodies --------------------------------------------
            if current_acl is not None:
                if self._parse_acl_body(
                    model, current_acl, line, line_number, current_acl_header
                ):
                    index += 1
                    continue

            # ---- top level ----------------------------------------------------
            handled = self._parse_global_line(
                model, line, line_number, current_line_block
            )
            if handled:
                index += 1
                continue

            if any(pattern.match(line) for pattern in CISCO_PARTIAL_PATTERNS):
                model.partial.append(line)
                index += 1
                continue

            model.unparsed.append(
                UnparsedCommand(raw=line, line=line_number, reason="Unrecognised command")
            )
            index += 1

        return ParseResult(config=model, ignored_lines=ignored)

    # -- helpers -------------------------------------------------------------------

    def _parse_interface_line(self, model: NetworkConfig, name: str, line: str) -> bool:
        interface = model.interface(name)
        if interface is None:
            return False

        match = re.match(r"^description\s+(.+)$", line, re.I)
        if match:
            interface.description = match.group(1).strip()
            return True

        match = _IP_ADDRESS_RE.match(line)
        if match:
            interface.addresses.append(
                Address(
                    address=match.group(1),
                    prefix=addressing.mask_to_prefix(match.group(2)),
                    secondary=bool(match.group(3)),
                )
            )
            return True

        match = _IPV6_ADDRESS_RE.match(line)
        if match:
            cidr = addressing.split_cidr(match.group(1))
            if cidr:
                interface.addresses.append(Address(address=cidr[0], prefix=cidr[1]))
            return True

        match = re.match(r"^(?:mtu\s+(\d+)|ip\s+mtu\s+(\d+))$", line, re.I)
        if match:
            interface.mtu = int(match.group(1) or match.group(2))
            return True

        if re.match(r"^no\s+shutdown$", line, re.I):
            interface.admin_enabled = True
            return True
        if re.match(r"^shutdown$", line, re.I):
            interface.admin_enabled = False
            return True

        if re.match(r"^switchport$", line, re.I):
            interface.layer2 = True
            return True
        if re.match(r"^no\s+switchport$", line, re.I):
            # Explicitly a routed port.
            interface.layer2 = False
            interface.switchport_mode = None
            return True
        match = _SWPORT_MODE_RE.match(line)
        if match:
            interface.layer2 = True
            interface.switchport_mode = match.group(1).lower()
            return True
        match = _SWPORT_ACCESS_RE.match(line)
        if match:
            interface.layer2 = True
            interface.vlan_id = int(match.group(1))
            return True
        match = _SWPORT_TRUNK_RE.match(line)
        if match:
            interface.layer2 = True
            interface.allowed_vlans = self._parse_vlan_list(match.group(1))
            return True

        match = _CHANNEL_GROUP_RE.match(line)
        if match:
            interface.channel_group = match.group(1)
            return True

        match = _VRF_FORWARDING_RE.match(line)
        if match:
            model.partial.append(line)
            return True

        return False

    @staticmethod
    def _parse_vlan_list(value: str) -> list[int]:
        vlans: list[int] = []
        for part in value.split(","):
            token = part.strip().lower()
            if not token:
                continue
            if "-" in token:
                low, _, high = token.partition("-")
                try:
                    vlans.extend(range(int(low), int(high) + 1))
                except ValueError:
                    continue
            elif token == "all":
                continue
            else:
                try:
                    vlans.append(int(token))
                except ValueError:
                    continue
        return vlans

    def _parse_acl_body(
        self,
        model: NetworkConfig,
        current: tuple[str, str],
        line: str,
        line_number: int,
        header: Optional[str] = None,
    ) -> bool:
        kind, name = current
        # Sequenced form: `10 permit ip 10.0.0.0 0.0.0.255 any`
        match = re.match(r"^(\d{1,3})\s+(permit|deny)\s+(.*)$", line, re.I)
        if match:
            sequence = int(match.group(1))
            action = match.group(2).lower()
            body = match.group(3).strip()
            entry = self._build_acl_entry(name, kind, sequence, action, body, line, line_number)
            if entry is not None:
                entry.definition = header
                add_acl_entry(model, entry)
            return True

        # Sequenceless form: `permit ip 10.0.0.0 0.0.0.255 any`
        match = re.match(r"^(permit|deny)\s+(.*)$", line, re.I)
        if match:
            action = match.group(1).lower()
            body = match.group(2).strip()
            entry = self._build_acl_entry(name, kind, None, action, body, line, line_number)
            if entry is not None:
                entry.definition = header
                add_acl_entry(model, entry)
            return True

        # A remark line documents the ACL; keep it as context.
        if re.match(r"^remark\b", line, re.I):
            model.partial.append(line)
            return True

        return False

    @staticmethod
    def _build_acl_entry(
        acl_name: str,
        kind: str,
        sequence: Optional[int],
        action: str,
        body: str,
        raw: str,
        line_number: int,
    ) -> Optional[AclEntry]:
        tokens = body.split()
        if kind == "standard":
            if not tokens:
                return None
            return AclEntry(
                acl_name=acl_name,
                sequence=sequence,
                action=action,  # type: ignore[arg-type]
                source=tokens[0],
                raw=raw,
                source_command=raw,
            )

        # Extended: [seq] permit|deny <protocol> src [dst] ...
        if not tokens:
            return None
        protocol = tokens[0]
        rest = tokens[1:]
        source = rest[0] if rest else None
        destination = None
        # Simplified extended parsing: "any" / a.b.c.d w.w.w.w pairs.
        if len(rest) >= 2:
            second = rest[1]
            if second.lower() in {"any", "host"} or re.match(r"^\d+\.\d+\.\d+\.\d+$", second):
                destination = " ".join(rest[1:3])
        return AclEntry(
            acl_name=acl_name,
            sequence=sequence,
            action=action,  # type: ignore[arg-type]
            protocol=protocol,
            source=source,
            destination=destination,
            raw=raw,
            source_command=raw,
        )

    def _parse_global_line(
        self, model: NetworkConfig, line: str, line_number: int, current_line_block: Optional[str]
    ) -> bool:
        match = _HOSTNAME_RE.match(line)
        if match:
            model.hostname = match.group(1)
            return True

        match = _VERSION_RE.match(line)
        if match:
            model.software_version = match.group(1)
            return True

        match = _IP_DOMAIN_RE.match(line)
        if match:
            model.domain_name = match.group(1)
            return True

        match = re.match(r"^domain-name\s+(\S+)\s*$", line, re.I)
        if match:
            model.domain_name = match.group(1)
            return True

        if _IP_SSH_VERSION_RE.match(line):
            model.ssh = model.ssh or SshServer()
            model.ssh.version = int(_IP_SSH_VERSION_RE.match(line).group(1))  # type: ignore[union-attr]
            return True
        if _IP_SSH_TIMEOUT_RE.match(line):
            model.ssh = model.ssh or SshServer()
            model.ssh.timeout = int(_IP_SSH_TIMEOUT_RE.match(line).group(1))  # type: ignore[union-attr]
            return True
        if _IP_SSH_RETRIES_RE.match(line):
            model.ssh = model.ssh or SshServer()
            model.ssh.retries = int(_IP_SSH_RETRIES_RE.match(line).group(1))  # type: ignore[union-attr]
            return True

        match = re.match(r"^service\s+telnet\s+(\S+)\s*$", line, re.I)
        if match:
            enabled = match.group(1).lower() not in {"0", "disable", "disabled"}
            model.telnet = model.telnet or TelnetServer()
            model.telnet.enabled = enabled
            model.telnet.source_command = line
            return True
        if re.match(r"^no\s+service\s+telnet\s*$", line, re.I):
            model.telnet = TelnetServer(enabled=False, source_command=line)
            return True

        match = re.match(r"^service\s+password-encryption\s*$", line, re.I)
        if match:
            model.password_encryption = True
            return True
        if re.match(r"^no\s+service\s+password-encryption\s*$", line, re.I):
            model.password_encryption = False
            return True

        match = _IP_ROUTE_RE.match(line)
        if match:
            network, mask = match.group(1), match.group(2)
            next_hop = match.group(3)
            distance = int(match.group(4)) if match.group(4) else None
            model.static_routes.append(
                StaticRoute(
                    prefix=f"{network}/{addressing.mask_to_prefix(mask)}",
                    next_hop=next_hop,
                    distance=distance,
                    source_command=line,
                )
            )
            return True

        match = _ACCESS_LIST_INLINE_RE.match(line)
        if match:
            name, action, body = match.group(1), match.group(2).lower(), match.group(3)
            kind = "standard" if re.match(r"^\d{2,3}$", name) else "extended"
            entry = self._build_acl_entry(name, kind, None, action, body, line, line_number)
            if entry is not None:
                add_acl_entry(model, entry)
            return True

        match = re.match(
            r"^ip\s+access-list\s+(standard|extended)\s+(\S+)\s+(permit|deny)\s+(.*)$",
            line,
            re.I,
        )
        if match:
            entry = self._build_acl_entry(
                match.group(2),
                match.group(1).lower(),
                None,
                match.group(3).lower(),
                match.group(4),
                line,
                line_number,
            )
            if entry is not None:
                add_acl_entry(model, entry)
            return True

        match = _IP_DNS_RE.match(line)
        if match:
            for server in match.group(1).split():
                if server not in model.name_servers:
                    model.name_servers.append(server)
            return True

        match = _NTP_RE.match(line)
        if match:
            model.ntp_servers.append(
                NtpServer(
                    address=match.group(1),
                    key=int(match.group(2)) if match.group(2) else None,
                    prefer=bool(re.search(r"\bprefer\b", line, re.I)),
                    source_command=line,
                )
            )
            return True

        match = _LOGGING_HOST_RE.match(line)
        if match:
            model.syslog_hosts.append(
                SyslogHost(
                    address=match.group(1),
                    level=match.group(2),
                    facility=match.group(3),
                )
            )
            return True
        match = _LOGGING_BUFFERED_RE.match(line)
        if match:
            model.logging_buffered_size = int(match.group(1))
            model.logging_level = match.group(2).lower()
            return True
        match = _LOGGING_TRAP_RE.match(line)
        if match:
            model.logging_level = match.group(1).lower()
            return True

        match = _SNMP_RE.match(line)
        if match:
            model.snmp.append(
                SnmpCommunity(
                    community=match.group(1),
                    access="rw" if match.group(2).lower() == "rw" else "ro",
                    source_command=line,
                )
            )
            return True

        match = _USERNAME_RE.match(line)
        if match:
            model.users.append(
                UserAccount(
                    name=match.group(1),
                    privilege=int(match.group(2)) if match.group(2) else None,
                    role=match.group(4),
                    secret_set=bool(match.group(3)),
                    source_command=line,
                )
            )
            return True

        match = _TRANSPORT_RE.match(line)
        if match and current_line_block is not None:
            transports = [t.strip().lower() for t in match.group(1).split(",")]
            if "telnet" in transports:
                model.telnet = model.telnet or TelnetServer()
                model.telnet.enabled = True
                model.telnet.source_command = line
            if "ssh" in transports:
                model.ssh = model.ssh or SshServer()
            return True

        # ---- NAT ------------------------------------------------------------
        if _NAT_OUTSIDE_RE.match(line):
            model.partial.append(line)
            return True
        match = _NAT_INSIDE_RE.match(line)
        if match:
            model.nat.append(
                NatEntry(
                    nat_type="source",
                    inside_source=match.group(1),
                    translation=match.group(2) or "interface address",
                    overload=bool(match.group(3)),
                    raw=line,
                )
            )
            return True
        match = re.match(
            r"^ip\s+nat\s+inside\s+source\s+interface\s+(\S+)\s+overload\s*$", line, re.I
        )
        if match:
            model.nat.append(
                NatEntry(
                    nat_type="source",
                    inside_source="interface",
                    translation=match.group(1),
                    overload=True,
                    raw=line,
                )
            )
            return True

        match = re.match(r"^ip\s+access-group\s+(\S+)\s+(in|out)\s*$", line, re.I)
        if match:
            model.acl_applications.append(
                AclApplication(
                    target="interface",
                    direction=match.group(2).lower(),
                    acl_name=match.group(1),
                    source_command=line,
                )
            )
            return True

        match = re.match(r"^feature\s+(\S+)\s*$", line, re.I)
        if match:
            if match.group(1) not in model.features:
                model.features.append(match.group(1))
            return True

        return False


# --------------------------------------------------------------------------------------
# Renderer
# --------------------------------------------------------------------------------------


class CiscoLikeConverter(BaseConverter):
    """Base converter for Cisco-style CLIs."""

    family = CliFamily.CISCO_LIKE
    #: Cisco-style platforms do not all take the same interface naming.
    vlan_name_style: str = "inline"  # "inline" (NX-OS/EOS) or "none"
    supports_bgp = True
    supports_ospf = True
    supports_snmp = True
    supports_users = True
    supports_acl = True
    supports_nat = True
    supports_banner = True
    supports_syslog = True
    comment_char = "!"

    def __init__(self) -> None:
        self.parser = CiscoLikeParser(self)

    @property
    def platform_name(self) -> str:
        return self.platform.value

    def accept_line(self, line: str) -> bool:
        """Hook: reject lines that clearly belong to another platform."""
        return True

    def parse(self, text: str) -> ParseResult:
        return self.parser.parse(text)

    # -- rendering --------------------------------------------------------------

    def render(self, model: NetworkConfig) -> RenderResult:
        result = RenderResult(config="")
        out: list[str] = []
        add = out.append

        add(f"{self.comment_char} CYBERSURE conversion")
        add(f"{self.comment_char} Generated by the CYBERSURE conversion engine")
        add(f"{self.comment_char} Review requires_review and unsupported items before deployment.")
        add("")

        if model.hostname:
            add(f"hostname {model.hostname}")
            result.translated += 1
        if model.domain_name and self.supports("domain_name"):
            add(f"ip domain-name {model.domain_name}")
            result.translated += 1
        elif model.domain_name:
            self.require(
                result,
                "domain_name",
                "IP domain name",
                f"{self.platform_name} has no equivalent of `ip domain-name`.",
            )

        if model.features:
            for feature in model.features:
                add(f"feature {feature}")
            result.translated += len(model.features)

        if model.password_encryption is not None and model.password_encryption:
            add("service password-encryption")
            result.translated += 1

        # ---- SSH / telnet ---------------------------------------------------
        if model.ssh is not None:
            if model.ssh.version is not None:
                add(f"ip ssh version {model.ssh.version}")
            if model.ssh.timeout is not None:
                add(f"ip ssh timeout {model.ssh.timeout}")
            if model.ssh.retries is not None:
                add(f"ip ssh authentication-retries {model.ssh.retries}")
            result.translated += 1
        if model.telnet is not None:
            if model.telnet.enabled:
                add("service telnet")
                self.review(
                    result,
                    "Telnet service",
                    "Telnet is enabled in the source; it is reproduced here and must be "
                    "confirmed as intentional.",
                    model.telnet.source_command or "service telnet",
                )
            else:
                add("no service telnet")
            result.translated += 1

        if model.users and not self.supports_users:
            self.require(
                result,
                "users",
                "Local user accounts",
                f"{self.platform_name} manages local users outside the running configuration.",
            )
        elif model.users:
            for user in model.users:
                parts = [f"username {user.name}"]
                if user.privilege is not None:
                    parts.append(f"privilege {user.privilege}")
                add(" ".join(parts))
            self.review(
                result,
                "Local user accounts",
                "Credentials were not carried over; re-create them on the target.",
            )
            result.translated += len(model.users)

        if out and out[-1] != "":
            add("")

        # ---- VLANs -----------------------------------------------------------
        for vlan in model.vlans:
            add(f"vlan {vlan.vlan_id}")
            if vlan.name and self.vlan_name_style == "inline":
                add(f" name {vlan.name}")
            result.translated += 1
        if model.vlans:
            add("")

        # ---- Interfaces -------------------------------------------------------
        for interface in model.interfaces:
            self._render_interface(result, add, interface)
        if model.interfaces:
            add("")

        # ---- Routing ----------------------------------------------------------
        if model.static_routes:
            for route in model.static_routes:
                network, _, prefix = route.prefix.partition("/")
                mask = addressing.prefix_to_mask(int(prefix or 24))
                parts = [f"ip route {network} {mask}"]
                if route.next_hop:
                    parts.append(route.next_hop)
                if route.distance is not None:
                    parts.append(str(route.distance))
                add(" ".join(parts))
                result.translated += 1
            add("")

        if model.ospf and not self.supports_ospf:
            self.require(
                result,
                "ospf",
                "OSPF process",
                f"{self.platform_name} does not implement OSPF in this converter.",
            )
        elif model.ospf:
            for process in model.ospf:
                add(f"router ospf {process.process_id}")
                if process.router_id:
                    add(f" router-id {process.router_id}")
                for network in process.networks:
                    address, _, prefix = network.prefix.partition("/")
                    add(f" network {address} {addressing.prefix_to_mask(int(prefix or 24))} area {network.area}")
                add("!")
                result.translated += 1
            add("")

        if model.bgp and not self.supports_bgp:
            self.require(
                result,
                "bgp",
                "BGP process",
                f"{self.platform_name} does not implement BGP in this converter.",
            )
        elif model.bgp:
            for process in model.bgp:
                add(f"router bgp {process.asn}")
                if process.router_id:
                    add(f" bgp router-id {process.router_id}")
                for neighbor in process.neighbors:
                    add(f" neighbor {neighbor.address} remote-as {neighbor.remote_as}")
                for network in process.networks:
                    address, _, prefix = network.partition("/")
                    add(f" network {address} mask {addressing.prefix_to_mask(int(prefix or 24))}")
                add("!")
                result.translated += 1
            add("")

        # ---- ACLs -------------------------------------------------------------
        if model.acls and not self.supports_acl:
            self.require(
                result,
                "acl",
                "Access control lists",
                f"{self.platform_name} access lists use a policy engine this converter "
                "does not translate automatically.",
            )
        elif model.acls:
            grouped: dict[str, list[AclEntry]] = {}
            for entry in model.acls:
                grouped.setdefault(entry.acl_name, []).append(entry)
            for name, entries in grouped.items():
                is_standard = all(
                    entry.protocol is None for entry in entries
                ) and not any(entry.sequence for entry in entries)
                kind = "standard" if is_standard else "extended"
                if entries[0].sequence is not None and not is_standard:
                    add(f"ip access-list {kind} {name}")
                    for entry in entries:
                        add(f" {entry.sequence} {entry.action} {self._acl_body(entry)}")
                else:
                    add(f"ip access-list {kind} {name}")
                    for entry in entries:
                        add(f" {entry.action} {self._acl_body(entry)}")
                add("!")
                result.translated += len(entries)
            for application in model.acl_applications:
                if application.target == "interface" and application.direction:
                    add(f"ip access-group {application.acl_name} {application.direction}")
                elif application.target == "vty" and application.direction:
                    add("line vty 0 15")
                    add(f" access-class {application.acl_name} {application.direction}")
                    add(" exit")
                else:
                    self.review(
                        result,
                        "ACL application",
                        f"ACL {application.acl_name} application to "
                        f"{application.target} was not translated.",
                        application.source_command,
                    )
            add("")

        # ---- NAT ---------------------------------------------------------------
        if model.nat and not self.supports_nat:
            self.require(
                result,
                "nat",
                "NAT rules",
                f"{self.platform_name} NAT policy is not translated by this converter.",
            )
        elif model.nat:
            for entry in model.nat:
                if entry.nat_type == "source":
                    if entry.inside_source == "interface":
                        add(
                            f"ip nat inside source interface {entry.translation} "
                            f"{'overload' if entry.overload else ''}".rstrip()
                        )
                    else:
                        suffix = " overload" if entry.overload else ""
                        add(
                            f"ip nat inside source list {entry.inside_source} "
                            f"{entry.translation}{suffix}"
                        )
                    self.review(
                        result,
                        "NAT rule",
                        "Verify the inside list and the global address before deployment.",
                        entry.raw,
                    )
                else:
                    add(f"ip nat inside destination {entry.raw.split()[-1]}")
            add("")

        # ---- Services ----------------------------------------------------------
        if model.name_servers:
            add(f"ip name-server {' '.join(model.name_servers)}")
            result.translated += 1
        if model.ntp_servers:
            for server in model.ntp_servers:
                parts = [f"ntp server {server.address}"]
                if server.key is not None:
                    parts.append(f"key {server.key}")
                if server.prefer:
                    parts.append("prefer")
                add(" ".join(parts))
            result.translated += len(model.ntp_servers)
        if model.logging_level and model.logging_buffered_size:
            add(f"logging buffered {model.logging_buffered_size} {model.logging_level}")
        elif model.logging_level:
            add(f"logging trap {model.logging_level}")
        if model.syslog_hosts:
            if not self.supports_syslog:
                self.require(
                    result,
                    "syslog",
                    "Syslog servers",
                    f"{self.platform_name} does not forward syslog from the running configuration.",
                )
            else:
                for host in model.syslog_hosts:
                    add(f"logging host {host.address}")
                result.translated += len(model.syslog_hosts)
        if model.snmp:
            if not self.supports_snmp:
                self.require(
                    result,
                    "snmp",
                    "SNMP communities",
                    f"{self.platform_name} does not configure SNMP communities in the running configuration.",
                )
            else:
                for community in model.snmp:
                    access = (community.access or "ro").upper()
                    add(f"snmp-server community {community.community} {access}")
                result.translated += len(model.snmp)
                self.review(
                    result,
                    "SNMP communities",
                    "Community strings were carried over as-is; rotate them on the target.",
                )

        # ---- Banners -----------------------------------------------------------
        if model.banner_motd and self.supports_banner:
            add(f"banner motd ^{self.comment_char}")
            add(model.banner_motd)
            add(f"^{self.comment_char}")
            result.translated += 1
        elif model.banner_motd:
            self.require(
                result,
                "banner",
                "Message-of-the-day banner",
                f"{self.platform_name} has no inline banner in this converter.",
            )

        add("")
        result.config = "\n".join(out).rstrip() + "\n"
        return result

    # -- helpers -------------------------------------------------------------------

    @staticmethod
    def _acl_body(entry) -> str:
        parts: list[str] = []
        if entry.protocol:
            parts.append(entry.protocol)
        if entry.source:
            parts.append(entry.source)
        if entry.destination:
            parts.append(entry.destination)
        return " ".join(parts) if parts else "any any"

    def interface_name(self, name: str) -> str:
        """Hook: how this platform names a physical interface.

        Defaults to Cisco vendor naming; AOS-CX and others override.
        """
        return addressing.to_cisco_interface(name)

    def _render_interface(self, result: RenderResult, add, interface) -> None:
        name = self.interface_name(interface.name)
        add(f"interface {name}")
        if interface.description:
            add(f" description {interface.description}")
        for address in interface.addresses:
            mask = addressing.prefix_to_mask(address.prefix)
            secondary = " secondary" if address.secondary else ""
            add(f" ip address {address.address} {mask}{secondary}")
        if interface.mtu is not None:
            add(f" mtu {interface.mtu}")
        if interface.switchport_mode == "access" or interface.vlan_id is not None:
            add(" switchport")
            if interface.switchport_mode:
                add(f" switchport mode {interface.switchport_mode}")
            if interface.vlan_id is not None:
                add(f" switchport access vlan {interface.vlan_id}")
        elif interface.switchport_mode == "trunk":
            add(" switchport mode trunk")
            if interface.allowed_vlans:
                rendered = ",".join(str(v) for v in interface.allowed_vlans)
                add(f" switchport trunk allowed vlan {rendered}")
        if interface.channel_group:
            add(f" channel-group {interface.channel_group} mode active")
        if interface.admin_enabled is False:
            add(" shutdown")
        elif interface.admin_enabled is True:
            add(" no shutdown")
        add(" exit")
        result.translated += 1
