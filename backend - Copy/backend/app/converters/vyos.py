"""VyOS converter.

VyOS 1.4+ uses a flat `set` syntax with `configure`/`commit`, and addresses
interfaces as `eth0`, `eth1`, ...
"""

from __future__ import annotations

import re
from typing import Optional

from app.converters.base import BaseConverter, ParseResult, RenderResult
from app.models.device import CliFamily, PlatformId
from app.models.network import (
    Address,
    Interface,
    NetworkConfig,
    NtpServer,
    SshServer,
    StaticRoute,
    SyslogHost,
    UnparsedCommand,
)
from app.utils import addressing

_KEYED_RE = re.compile(r"^set\s+(\S+)\s+(\S+)\s+'?([^']*)'?\s*$", re.I)


def _unquote(value: str) -> str:
    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
        return value[1:-1]
    return value


class VyosParser:
    def parse(self, text: str) -> ParseResult:
        model = NetworkConfig()
        lines = text.splitlines()
        ignored = 0

        for index, raw in enumerate(lines):
            line_number = index + 1
            stripped = raw.strip()
            if not stripped or stripped.startswith("#") or stripped.startswith("/*"):
                ignored += 1
                continue
            if stripped.lower() in {"configure", "commit", "exit", "top"}:
                continue

            if not stripped.lower().startswith("set "):
                model.unparsed.append(
                    UnparsedCommand(raw=stripped, line=line_number, reason="Not a VyOS set statement")
                )
                continue
            if not self._apply(model, stripped[4:].strip(), line_number):
                model.unparsed.append(
                    UnparsedCommand(raw=stripped, line=line_number, reason="Unrecognised VyOS statement")
                )
        return ParseResult(config=model, ignored_lines=ignored)

    def _apply(self, model: NetworkConfig, payload: str, line_number: int) -> bool:
        tokens = [_unquote(token) for token in payload.split()]
        if not tokens:
            return True
        head = tokens[0].lower()

        if head == "host-name" and len(tokens) > 1:
            model.hostname = tokens[1]
            return True
        if head == "domain-name" and len(tokens) > 1:
            model.domain_name = tokens[1]
            return True
        if head == "name-server" and len(tokens) > 1:
            for server in tokens[1:]:
                if server not in model.name_servers:
                    model.name_servers.append(server)
            return True
        if head == "system" and len(tokens) > 2:
            # set system ntp server 1.2.3.4
            if tokens[1].lower() == "ntp" and tokens[2].lower() == "server" and len(tokens) > 3:
                model.ntp_servers.append(NtpServer(address=tokens[3]))
                return True
            if tokens[1].lower() == "login" and tokens[2].lower() == "message":
                model.banner_motd = " ".join(tokens[3:]) or None
                return True
            if tokens[1].lower() == "time-zone":
                return True
            return False
        if head == "service" and len(tokens) > 2:
            if tokens[1].lower() == "ssh":
                model.ssh = SshServer(version=2)
                if tokens[2].lower() == "disable":
                    model.ssh = None
                return True
            return False
        if head == "interfaces" and len(tokens) > 2:
            return self._interface(model, tokens)
        if head == "ip" and len(tokens) > 1:
            return self._ip(model, tokens)
        if head == "vlan" and len(tokens) > 1 and tokens[1].isdigit():
            from app.models.network import Vlan

            vlan_id = int(tokens[1])
            if model.vlan(vlan_id) is None:
                model.vlans.append(Vlan(vlan_id=vlan_id))
            return True
        if head in {"firewall", "vlan"}:
            model.partial.append(f"set {' '.join(tokens)}")
            return True
        return False

    @staticmethod
    def _interface(model: NetworkConfig, tokens: list[str]) -> bool:
        name = tokens[1]
        interface = model.interface(name)
        if interface is None:
            interface = Interface(name=name)
            model.interfaces.append(interface)
        if len(tokens) < 3:
            return True
        key = tokens[2].lower()
        if key == "description" and len(tokens) > 3:
            interface.description = " ".join(tokens[3:])
            return True
        if key == "address" and len(tokens) > 3:
            cidr = addressing.split_cidr(tokens[3])
            if cidr:
                interface.addresses.append(Address(address=cidr[0], prefix=cidr[1]))
            return True
        if key == "mtu" and len(tokens) > 3:
            try:
                interface.mtu = int(tokens[3])
            except ValueError:
                return False
            return True
        if key == "disable":
            interface.admin_enabled = False
            return True
        if key == "vrf":
            model.partial.append(f"set interfaces {name} vrf {tokens[3] if len(tokens) > 3 else ''}")
            return True
        return True

    @staticmethod
    def _ip(model: NetworkConfig, tokens: list[str]) -> bool:
        if len(tokens) < 3:
            return False
        section = tokens[1].lower()
        if section == "route" and len(tokens) > 3:
            prefix = tokens[2]
            next_hop = None
            for position, token in enumerate(tokens):
                if token.lower() == "via" and position + 1 < len(tokens):
                    next_hop = tokens[position + 1]
                    break
            model.static_routes.append(StaticRoute(prefix=prefix, next_hop=next_hop))
            return True
        if section == "name-server":
            for server in tokens[2:]:
                if server not in model.name_servers:
                    model.name_servers.append(server)
            return True
        return False


class VyosConverter(BaseConverter):
    platform = PlatformId.VYOS
    family = CliFamily.VYOS

    def __init__(self) -> None:
        self.parser = VyosParser()

    def parse(self, text: str) -> ParseResult:
        return self.parser.parse(text)

    def render(self, model: NetworkConfig) -> RenderResult:
        result = RenderResult(config="")
        out: list[str] = []
        add = out.append

        add("# CYBERSURE conversion")
        add("# Generated by the CYBERSURE conversion engine")
        add("# Review requires_review and unsupported items before deployment.")
        add("")
        add("configure")

        if model.hostname:
            add(f"set host-name '{model.hostname}'")
            result.translated += 1
        if model.domain_name:
            add(f"set domain-name '{model.domain_name}'")
            result.translated += 1
        if model.ssh is not None:
            add("set service ssh port 22")
            result.translated += 1
        for server in model.name_servers:
            add(f"set system name-server '{server}'")
        if model.name_servers:
            result.translated += 1
        for server in model.ntp_servers:
            add(f"set system ntp server '{server.address}'")
            result.translated += 1
        if model.banner_motd:
            add(f"set system login message '{model.banner_motd}'")
            result.translated += 1

        for interface in model.interfaces:
            name = addressing.vyos_interface_name(interface.name)
            add(f"set interfaces ethernet {name}")
            if interface.description:
                add(f"set interfaces ethernet {name} description '{interface.description}'")
            for address in interface.addresses:
                if ":" in address.address:
                    continue
                add(f"set interfaces ethernet {name} address '{address.address}/{address.prefix}'")
            if interface.mtu is not None:
                add(f"set interfaces ethernet {name} mtu {interface.mtu}")
            if interface.admin_enabled is False:
                add(f"set interfaces ethernet {name} disable")
            result.translated += 1

        for route in model.static_routes:
            via = f" via '{route.next_hop}'" if route.next_hop else ""
            add(f"set ip route {route.prefix}{via}")
            result.translated += 1

        if model.syslog_hosts:
            self.review(
                result,
                "Syslog",
                "VyOS forwards logs with `set system syslog global log-facility all`; "
                "add the target host entries manually.",
            )
        if model.acls:
            self.require(
                result,
                "acl",
                "Firewall rules",
                "VyOS firewall rules are ordered rule sets; not translated automatically.",
            )
        if model.ospf or model.bgp:
            self.require(
                result,
                "dynamic-routing",
                "Dynamic routing",
                "VyOS dynamic routing requires protocol keyword arguments.",
            )
        if model.nat:
            self.require(
                result,
                "nat",
                "NAT",
                "VyOS source NAT is declared inside the firewall ruleset.",
            )
        if model.snmp:
            self.require(
                result,
                "snmp",
                "SNMP communities",
                "VyOS SNMP communities are set per community with a view and access.",
            )

        add("commit")
        result.config = "\n".join(out).rstrip() + "\n"
        return result
