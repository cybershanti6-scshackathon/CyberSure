"""Huawei VRP converter.

VRP is structurally different from Cisco: a `system-view` block, `interface
<Name>` blocks using `ip address A M`, `ip route-static ...`, and `vlan N` with
a `name` sub-line.
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
    UnparsedCommand,
    Vlan,
)
from app.utils import addressing

_VIEW_COMMANDS = {"system-view", "interface", "vlan", "ip route-static", "router bgp", "ospf"}


class HuaweiVrpParser:
    def parse(self, text: str) -> ParseResult:
        model = NetworkConfig()
        lines = text.splitlines()
        ignored = 0
        block: Optional[str] = None

        for index, raw in enumerate(lines):
            line_number = index + 1
            stripped = raw.strip()
            if not stripped or stripped.startswith("#") or stripped == "return":
                ignored += 1
                if stripped == "return":
                    block = None
                continue
            if stripped in {"quit", "exit", "undoquit"}:
                block = None
                continue

            if re.match(r"^sysname\s+\S+", stripped, re.I):
                model.hostname = stripped.split()[1]
                continue
            if re.match(r"^ip\s+domain-name\s+\S+", stripped, re.I):
                model.domain_name = stripped.split()[2]
                continue

            interface_match = re.match(r"^interface\s+(\S+)\s*$", stripped, re.I)
            if interface_match:
                block = "interface"
                self._interface(model, interface_match.group(1))
                continue

            vlan_match = re.match(r"^vlan\s+(\d+)\s*$", stripped, re.I)
            if vlan_match:
                block = "vlan"
                if model.vlan(int(vlan_match.group(1))) is None:
                    model.vlans.append(Vlan(vlan_id=int(vlan_match.group(1))))
                continue

            if re.match(r"^ip\s+route-static\s+", stripped, re.I):
                tokens = stripped.split()
                if len(tokens) >= 5:
                    model.static_routes.append(
                        StaticRoute(
                            prefix=f"{tokens[2]}/{addressing.mask_to_prefix(tokens[3])}",
                            next_hop=tokens[4],
                            source_command=stripped,
                        )
                    )
                    continue
            if re.match(r"^ip\s+route-static\s+\S+\s+\S+\s+\S+\s+\S+\s+\S+", stripped, re.I):
                tokens = stripped.split()
                model.static_routes.append(
                    StaticRoute(
                        prefix=f"{tokens[3]}/{addressing.mask_to_prefix(tokens[4])}",
                        next_hop=tokens[5],
                        source_command=stripped,
                    )
                )
                continue

            if block == "interface" and not stripped.startswith("interface "):
                target = self._current_interface(model, lines, index)
                if target is not None and self._interface_line(model, target, stripped):
                    continue
            if block == "vlan" and not stripped.startswith("vlan "):
                vlan_match = re.match(r"^name\s+(.+)$", stripped, re.I)
                if vlan_match:
                    for vlan in model.vlans:
                        if vlan.name is None:
                            vlan.name = vlan_match.group(1).strip()
                            break
                    continue

            if stripped.lower() in {"system-view", "quit"}:
                continue
            if re.match(r"^ntp\s+server\s+", stripped, re.I):
                tokens = stripped.split()
                if len(tokens) >= 3:
                    prefer = "prefer" in tokens
                    model.ntp_servers.append(NtpServer(address=tokens[2], prefer=prefer))
                    continue
            if re.match(r"^ip\s+name-server\s+", stripped, re.I):
                for server in stripped.split()[2:]:
                    if server not in model.name_servers:
                        model.name_servers.append(server)
                continue
            if re.match(r"^(stelnet|telnet)\s+server\s+enable", stripped, re.I):
                from app.models.network import TelnetServer

                model.telnet = TelnetServer(enabled=True, source_command=stripped)
                continue
            if re.match(r"^stelnet\s+server\s+disable", stripped, re.I):
                from app.models.network import TelnetServer

                model.telnet = TelnetServer(enabled=False, source_command=stripped)
                continue
            if re.match(r"^(dhcp|arp|snmp-agent|user-interface|aaa|info-center|ftp)\b", stripped, re.I):
                model.partial.append(stripped)
                continue

            model.unparsed.append(
                UnparsedCommand(raw=stripped, line=line_number, reason="Unrecognised VRP statement")
            )

        return ParseResult(config=model, ignored_lines=ignored)

    @staticmethod
    def _current_interface(model: NetworkConfig, lines: list[str], index: int) -> Optional[str]:
        # Walk backwards to the nearest `interface` header.
        for position in range(index - 1, -1, -1):
            stripped = lines[position].strip()
            match = re.match(r"^interface\s+(\S+)\s*$", stripped, re.I)
            if match:
                return match.group(1)
            if stripped in {"quit", "exit", "return"}:
                return None
        del model
        return None

    @staticmethod
    def _interface(model: NetworkConfig, name: str) -> Interface:
        existing = model.interface(name)
        if existing is not None:
            return existing
        created = Interface(name=name)
        model.interfaces.append(created)
        return created

    def _interface_line(self, model: NetworkConfig, name: str, line: str) -> bool:
        interface = model.interface(name)
        if interface is None:
            return False
        match = re.match(r"^description\s+(.+)$", line, re.I)
        if match:
            interface.description = match.group(1).strip()
            return True
        match = re.match(
            r"^ip\s+address\s+(\d{1,3}(?:\.\d{1,3}){3})\s+(\d{1,3}(?:\.\d{1,3}){3})(\s+sub)?$",
            line,
            re.I,
        )
        if match:
            interface.addresses.append(
                Address(
                    address=match.group(1),
                    prefix=addressing.mask_to_prefix(match.group(2)),
                    secondary=bool(match.group(3)),
                )
            )
            return True
        match = re.match(r"^mtu\s+(\d+)$", line, re.I)
        if match:
            interface.mtu = int(match.group(1))
            return True
        if re.match(r"^undo\s+shutdown$", line, re.I):
            interface.admin_enabled = True
            return True
        if re.match(r"^shutdown$", line, re.I):
            interface.admin_enabled = False
            return True
        if re.match(r"^port\s+link-type\s+trunk", line, re.I):
            interface.layer2 = True
            interface.switchport_mode = "trunk"
            return True
        if re.match(r"^port\s+default\s+vlan\s+(\d+)", line, re.I):
            interface.layer2 = True
            interface.vlan_id = int(match.group(1))  # type: ignore[union-attr]
            return True
        return False


class HuaweiVrpConverter(BaseConverter):
    platform = PlatformId.HUAWEI_VRP
    family = CliFamily.HUAWEI_VRP

    def __init__(self) -> None:
        self.parser = HuaweiVrpParser()

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

        if model.hostname:
            add(f"sysname {model.hostname}")
            result.translated += 1
        if model.domain_name:
            add(f"ip domain-name {model.domain_name}")
            result.translated += 1
        if model.ssh is not None:
            add("stelnet server enable")
            self.review(
                result,
                "SSH",
                "VRP enables SSH as `stelnet server enable` plus a key pair; generate "
                "the local keys on the target.",
            )
        if model.telnet is not None and not model.telnet.enabled:
            add("telnet server disable")
            result.translated += 1

        for vlan in model.vlans:
            add(f"vlan {vlan.vlan_id}")
            if vlan.name:
                add(f" name {vlan.name}")
            add("quit")
            result.translated += 1
        if model.vlans:
            add("")

        for interface in model.interfaces:
            name = addressing.huawei_interface_name(interface.name)
            add(f"interface {name}")
            if interface.description:
                add(f" description {interface.description}")
            for address in interface.addresses:
                if ":" in address.address:
                    continue
                add(f" ip address {address.address} {addressing.prefix_to_mask(address.prefix)}")
            if interface.mtu is not None:
                add(f" mtu {interface.mtu}")
            if interface.switchport_mode == "trunk":
                add(" port link-type trunk")
            if interface.vlan_id is not None:
                add(f" port default vlan {interface.vlan_id}")
            if interface.admin_enabled is False:
                add(" shutdown")
            add("quit")
            result.translated += 1
        if model.interfaces:
            add("")

        for route in model.static_routes:
            network, _, prefix = route.prefix.partition("/")
            mask = addressing.prefix_to_mask(int(prefix or 24))
            if route.next_hop:
                add(f"ip route-static {network} {mask} {route.next_hop}")
            else:
                add(f"ip route-static {network} {mask}")
            result.translated += 1
        if model.static_routes:
            add("")

        for server in model.name_servers:
            add(f"ip name-server {server}")
        if model.ntp_servers:
            for index, server in enumerate(model.ntp_servers, start=1):
                add(f"ntp server {index} {server.address}" + (" prefer" if server.prefer else ""))
        if model.name_servers or model.ntp_servers:
            add("")

        if model.acls:
            self.require(
                result,
                "acl",
                "Access control lists",
                "VRP traffic classifiers and behavior policies are not translated here.",
            )
        if model.ospf or model.bgp:
            self.require(
                result,
                "dynamic-routing",
                "Dynamic routing",
                "VRP routing instances require explicit configuration.",
            )
        if model.nat:
            self.require(
                result,
                "nat",
                "NAT",
                "VRP NAT address groups and nft rules are not translated automatically.",
            )

        result.config = "\n".join(out).rstrip() + "\n"
        return result
