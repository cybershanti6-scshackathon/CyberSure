"""Palo Alto PAN-OS converter."""

from __future__ import annotations

import re

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


class PanosParser:
    """Parses `set ...` / `edit ...` PAN-OS configuration."""

    def parse(self, text: str) -> ParseResult:
        model = NetworkConfig()
        lines = text.splitlines()
        ignored = 0

        for index, raw in enumerate(lines):
            line_number = index + 1
            stripped = raw.strip()
            if not stripped or stripped.startswith("#"):
                ignored += 1
                continue

            if not self._apply(model, stripped, line_number):
                model.unparsed.append(
                    UnparsedCommand(raw=stripped, line=line_number, reason="Unrecognised PAN-OS statement")
                )
        return ParseResult(config=model, ignored_lines=ignored)

    def _apply(self, model: NetworkConfig, line: str, line_number: int) -> bool:
        if line.startswith("set "):
            payload = line[4:].strip()
        elif line.startswith("edit "):
            payload = line[5:].strip()
        elif line.startswith("delete "):
            return True
        else:
            return False

        tokens = payload.split()
        if not tokens:
            return True
        head = tokens[0].lower()

        if head == "deviceconfig":
            return self._deviceconfig(model, tokens)
        if head == "interface":
            return self._interface(model, tokens)
        if head == "network":
            return self._network(model, tokens, line)
        if head == "vlan":
            return self._vlan(model, tokens)
        if head in {"commit", "load", "merge"}:
            return True
        return False

    @staticmethod
    def _deviceconfig(model: NetworkConfig, tokens: list[str]) -> bool:
        rest = tokens[1:]
        if not rest:
            return False
        key = rest[0].lower()
        if key == "hostname" and len(rest) > 1:
            model.hostname = rest[1]
            return True
        if key == "domain-name" and len(rest) > 1:
            model.domain_name = rest[1]
            return True
        if key == "ssh":
            model.ssh = model.ssh or SshServer()
            for token in rest[1:]:
                if token.lower() == "v2":
                    model.ssh.version = 2
            return True
        if key == "system" and len(rest) > 3 and rest[1].lower() == "setting":
            return self._system_setting(model, rest)
        return False

    @staticmethod
    def _system_setting(model: NetworkConfig, rest: list[str]) -> bool:
        for index, token in enumerate(rest):
            if token.lower() == "ntp-server-primary" and index + 1 < len(rest):
                model.ntp_servers.append(NtpServer(address=rest[index + 1]))
                return True
            if token.lower() == "external-logging" and index + 1 < len(rest):
                model.syslog_hosts.append(SyslogHost(address=rest[index + 1]))
                return True
        return False

    @staticmethod
    def _interface(model: NetworkConfig, tokens: list[str]) -> bool:
        if len(tokens) < 3:
            return False
        name = tokens[1]
        key = tokens[2].lower()
        interface = model.interface(name)
        if interface is None:
            interface = Interface(name=name)
            model.interfaces.append(interface)

        if key == "comment" and len(tokens) > 3:
            interface.description = " ".join(tokens[3:])
            return True
        if key == "ip-address" and len(tokens) > 3:
            parsed = addressing.split_cidr(tokens[3])
            if parsed:
                interface.addresses.append(Address(address=parsed[0], prefix=parsed[1]))
            return True
        if key == "state" and len(tokens) > 3:
            interface.admin_enabled = tokens[3].lower() == "up"
            return True
        if key == "mtu" and len(tokens) > 3:
            try:
                interface.mtu = int(tokens[3])
            except ValueError:
                return False
            return True
        if key == "vlan":
            interface.layer2 = True
            return True
        return False

    @staticmethod
    def _network(model: NetworkConfig, tokens: list[str], line: str) -> bool:
        # set network config edit static-1 set route 0.0.0.0/0 set nexthop ip X
        joined = " ".join(tokens).lower()
        if " route " in f" {joined} ":
            index = [t.lower() for t in tokens].index("route")
            if index + 1 < len(tokens):
                prefix = tokens[index + 1]
                next_hop = None
                for position, token in enumerate(tokens):
                    if token.lower() == "nexthop" and position + 2 < len(tokens):
                        next_hop = tokens[position + 2]
                        break
                model.static_routes.append(
                    StaticRoute(prefix=prefix, next_hop=next_hop, source_command=line)
                )
                return True
        return False

    @staticmethod
    def _vlan(model: NetworkConfig, tokens: list[str]) -> bool:
        from app.models.network import Vlan

        if len(tokens) < 2 or not tokens[1].isdigit():
            return False
        vlan_id = int(tokens[1])
        if model.vlan(vlan_id) is None:
            model.vlans.append(Vlan(vlan_id=vlan_id))
        for index, token in enumerate(tokens):
            if token.lower() == "name" and index + 1 < len(tokens):
                vlan = model.vlan(vlan_id)
                if vlan is not None:
                    vlan.name = tokens[index + 1]
        return True


class PanosConverter(BaseConverter):
    platform = PlatformId.PALOALTO_PANOS
    family = CliFamily.PANOS

    def __init__(self) -> None:
        self.parser = PanosParser()

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
            add(f"set deviceconfig hostname {model.hostname}")
            result.translated += 1
        if model.domain_name:
            add(f"set deviceconfig domain-name {model.domain_name}")
            result.translated += 1
        if model.ssh is not None:
            add("set deviceconfig ssh version v2")
            add("set deviceconfig ssh timeout 10")
            result.translated += 1

        for server in model.ntp_servers:
            add(
                "set config deviceconfig setting"
            )
            add(f"    set deviceconfig system setting ntp-server-primary {server.address}")
            result.translated += 1

        for host in model.syslog_hosts:
            add("set config deviceconfig setting")
            add(
                f"    set deviceconfig system setting external-logging {host.address}"
            )
            self.review(
                result,
                "Syslog",
                "PAN-OS forwards logs to a Panorama forwarding profile, not a device "
                "setting. The address was recorded for reference only.",
            )

        for vlan in model.vlans:
            add(f"set vlan {vlan.vlan_id}")
            if vlan.name:
                add(f'set vlan {vlan.vlan_id} name "{vlan.name}"')
            result.translated += 1

        for interface in model.interfaces:
            name = addressing.to_generic_interface(interface.name)
            if interface.description:
                add(f'set interface {name} comment "{interface.description}"')
            for address in interface.addresses:
                if ":" in address.address:
                    continue
                add(f"set interface {name} ip-address {address.address}/{address.prefix}")
                add(f"set interface {name} netmask {addressing.prefix_to_mask(address.prefix)}")
            if interface.mtu is not None:
                add(f"set interface {name} mtu {interface.mtu}")
            if interface.admin_enabled is not None:
                add(f"set interface {name} state {'up' if interface.admin_enabled else 'down'}")
            result.translated += 1

        if model.static_routes:
            add("set network config")
            for index, route in enumerate(model.static_routes, start=1):
                add(f"    edit static-{index}")
                add(f"        set route {route.prefix}")
                if route.next_hop:
                    add(f"        set nexthop ip {route.next_hop}")
                add("    default")
            result.translated += len(model.static_routes)
            self.review(
                result,
                "Static routes",
                "PAN-OS routes need an interface binding and are committed from the "
                "network configuration. Verify before committing.",
            )

        if model.name_servers:
            add("set config deviceconfig setting")
            add(f"    set deviceconfig client dns-server-primary {model.name_servers[0]}")
            result.translated += 1

        if model.acls or model.nat or model.ospf or model.bgp:
            self.require(
                result,
                "policy",
                "Security policy / dynamic routing",
                "PAN-OS security policy and dynamic routing are object-based. This "
                "converter does not invent policy objects.",
            )

        if model.banner_motd:
            self.review(
                result,
                "Banner",
                "PAN-OS uses login text and login banner objects; recreate them "
                "manually.",
                f"banner motd: {model.banner_motd}",
            )

        add("commit")
        result.config = "\n".join(out).rstrip() + "\n"
        return result
