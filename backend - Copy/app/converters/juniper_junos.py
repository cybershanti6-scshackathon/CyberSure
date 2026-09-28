"""Juniper Junos converter.

Handles both Junos syntaxes: flat `set` commands and brace-delimited hierarchy
(as seen in `show configuration | display set` and CLI edits).
"""

from __future__ import annotations

import re
from typing import Optional

from app.converters.base import (
    BaseConverter,
    ParseResult,
    RenderResult,
    add_acl_entry,
    upsert_interface,
)
from app.models.device import CliFamily, PlatformId
from app.models.network import (
    AclEntry,
    Address,
    NetworkConfig,
    NtpServer,
    SshServer,
    StaticRoute,
    SyslogHost,
    UnparsedCommand,
    Vlan,
)
from app.utils import addressing

# --------------------------------------------------------------------------------------
# Parser
# --------------------------------------------------------------------------------------


def _tokens(line: str) -> list[str]:
    return line.split()


def _unquote(value: str) -> str:
    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
        return value[1:-1]
    return value


class JunosParser:
    """Turns Junos configuration into the normalized model."""

    #: Path segments that only organise the hierarchy and carry no setting.
    STRUCTURAL = {"system", "interfaces", "routing-options", "protocols", "firewall",
                  "policy-options", "vlan-security", "access", "event-options", "chassis"}

    def parse(self, text: str) -> ParseResult:
        model = NetworkConfig()
        lines = text.splitlines()
        ignored = 0
        stack: list[str] = []

        def pop_stack() -> None:
            if stack:
                stack.pop()

        for index, raw in enumerate(lines):
            line_number = index + 1
            stripped = raw.strip()

            if not stripped:
                ignored += 1
                continue
            if stripped.startswith("#") or stripped.startswith("/*"):
                ignored += 1
                continue
            if stripped == "}":
                pop_stack()
                continue
            if stripped == "{":
                continue
            if stripped.lower() in {"commit", "exit", "quit"}:
                stack = []
                continue

            is_brace_open = stripped.endswith("{")
            is_brace_close = stripped.endswith("}")
            body = stripped
            if is_brace_open or is_brace_close:
                body = stripped[:-1].strip()

            if not body:
                continue

            if body.startswith("set ") or body.startswith("delete "):
                # Flat statements are self-contained; they never touch the stack.
                path = _tokens(body.split(None, 1)[1] if " " in body else "")
                if body.startswith("delete "):
                    # Deletions tell us nothing about the intended end state.
                    ignored += 1
                    continue
                if not self._apply(model, path, line_number):
                    model.unparsed.append(
                        UnparsedCommand(
                            raw=stripped, line=line_number, reason="Unrecognised Junos statement"
                        )
                    )
                continue

            path = _tokens(body)
            if not path:
                continue
            if is_brace_open:
                stack = path
                continue

            full = list(stack) + path
            if not self._apply(model, full, line_number):
                model.unparsed.append(
                    UnparsedCommand(
                        raw=stripped, line=line_number, reason="Unrecognised Junos statement"
                    )
                )
            if is_brace_close:
                pop_stack()

        # Normalise Junos addresses: collapse duplicates from multiple statements.
        self._normalise_units(model)
        return ParseResult(config=model, ignored_lines=ignored)

    def _apply(self, model: NetworkConfig, path: list[str], line_number: int) -> bool:
        if not path:
            return False
        head = path[0].lower()

        if head == "system":
            return self._system(model, path, line_number)
        if head == "interfaces":
            return self._interfaces(model, path, line_number)
        if head == "vlan-security" or (head == "vlans" and len(path) > 1):
            return self._vlans(model, path, line_number)
        if head == "routing-options":
            return self._routing_options(model, path, line_number)
        if head == "protocols":
            return self._protocols(model, path, line_number)
        if head == "firewall":
            return self._firewall(model, path, line_number)
        return False

    # -- system ------------------------------------------------------------------

    def _system(self, model: NetworkConfig, path: list[str], line_number: int) -> bool:
        if len(path) < 2:
            return False
        section = path[1].lower()

        # `set system name-server <addr>` has no further key.
        if section == "name-server":
            value = " ".join(_unquote(t) for t in path[2:])
            for server in value.split():
                if server not in model.name_servers:
                    model.name_servers.append(server)
            return bool(value)

        if len(path) < 3:
            return False
        key = path[2].lower()
        value = " ".join(_unquote(t) for t in path[3:])

        if section == "host-name" and not value:
            model.hostname = _unquote(path[2])
            return True
        if section == "domain-name" and not value:
            model.domain_name = _unquote(path[2])
            return True
        if section == "root-authentication" and key == "encrypted-password":
            model.password_encryption = True
            return True
        if section == "login":
            if key == "message":
                model.banner_motd = value or None
                return True
            if key == "user":
                model.password_encryption = True
                return True
            return False
        if section == "services":
            if key == "ssh":
                model.ssh = model.ssh or SshServer()
                if "protocol-version" in path:
                    for token in path:
                        if token.lower() == "v2":
                            model.ssh.version = 2
                return True
            if key == "telnet":
                model.ssh = model.ssh or SshServer()
                return False
            if key == "ssh" and value == "":
                return False
            return False
        if section == "syslog":
            if key == "host" and value:
                model.syslog_hosts.append(SyslogHost(address=value))
                return True
            if key == "file" and value:
                model.syslog_hosts.append(SyslogHost(address=value))
                return True
            if key in {"host", "any"} and value:
                model.syslog_hosts.append(SyslogHost(address=value))
                return True
            return False
        if section == "name-server" and value:
            for server in value.split():
                if server not in model.name_servers:
                    model.name_servers.append(server)
            return True
        if section == "ntp":
            if key == "server" and value:
                model.ntp_servers.append(NtpServer(address=value, prefer="prefer" in path))
                return True
            return False
        if section == "services" and key == "ssh":
            return False
        return False

    # -- interfaces ---------------------------------------------------------------

    def _interfaces(self, model: NetworkConfig, path: list[str], line_number: int) -> bool:
        if len(path) < 3:
            return False
        name = path[1]
        interface = upsert_interface(model, name)
        rest = [p.lower() for p in path[2:]]

        if rest[0] == "description":
            interface.description = " ".join(_unquote(t) for t in path[2:]) or None
            return True
        if rest[0] == "disable":
            interface.admin_enabled = False
            return True
        if rest[0] == "mtu" and len(rest) > 1:
            try:
                interface.mtu = int(rest[1])
            except ValueError:
                return False
            return True
        if rest[0] == "unit":
            # unit N family inet address A/P
            if "address" in rest:
                cidr = path[-1]
                parsed = addressing.split_cidr(cidr)
                if parsed:
                    interface.addresses.append(
                        Address(address=parsed[0], prefix=parsed[1])
                    )
                return True
            if "description" in rest:
                interface.description = _unquote(path[-1])
                return True
            return False
        if rest[0] == "family" and "inet" in rest and "address" in rest:
            parsed = addressing.split_cidr(path[-1])
            if parsed:
                interface.addresses.append(Address(address=parsed[0], prefix=parsed[1]))
            return True
        if rest[0] == "vlan-tagging":
            interface.layer2 = True
            interface.switchport_mode = "trunk"
            return True
        if rest[0] == "ether-options" and "ieee-802.3ad" in rest:
            interface.channel_group = "lag"
            return True
        if interface.addresses and "unit" not in rest:
            return True
        return False

    # -- vlans --------------------------------------------------------------------

    def _vlans(self, model: NetworkConfig, path: list[str], line_number: int) -> bool:
        if len(path) < 3:
            return False
        if path[1].lower() == "security" and path[2].lower() == "vlan-id":
            return False
        try:
            vlan_id = int(path[1])
        except ValueError:
            return False
        vlan = model.vlan(vlan_id)
        if vlan is None:
            vlan = Vlan(vlan_id=vlan_id)
            model.vlans.append(vlan)
        if len(path) > 2 and path[2].lower() == "name":
            vlan.name = _unquote(" ".join(path[3:]))
            return True
        return True

    # -- routing ------------------------------------------------------------------

    def _routing_options(self, model: NetworkConfig, path: list[str], line_number: int) -> bool:
        if len(path) >= 4 and path[1].lower() == "static":
            if path[2].lower() == "route":
                prefix = path[3]
                next_hop = None
                if "next-hop" in [p.lower() for p in path]:
                    idx = [p.lower() for p in path].index("next-hop")
                    if idx + 1 < len(path):
                        next_hop = path[idx + 1]
                model.static_routes.append(
                    StaticRoute(prefix=prefix, next_hop=next_hop)
                )
                return True
        if len(path) >= 3 and path[1].lower() == "router-id" and path[2].lower() == "asn":
            return False
        if len(path) >= 2 and path[1].lower() == "router-id":
            return False
        return False

    def _protocols(self, model: NetworkConfig, path: list[str], line_number: int) -> bool:
        if len(path) < 3:
            return False
        proto = path[1].lower()
        if proto == "ospf":
            if len(path) >= 4 and path[2].lower() == "router-id":
                return True
            if len(path) >= 5 and path[2].lower() == "area" and path[3].isdigit():
                return True
            if len(path) >= 3:
                return True  # process-level statements we do not model
            return False
        if proto == "bgp":
            if len(path) >= 3 and path[2].lower() == "group":
                return True
            if len(path) >= 3 and path[2].isdigit():
                return True
            return False
        return False

    def _firewall(self, model: NetworkConfig, path: list[str], line_number: int) -> bool:
        if len(path) < 2:
            return False
        if path[1].lower() == "family":
            return True
        return True

    @staticmethod
    def _normalise_units(model: NetworkConfig) -> None:
        for interface in model.interfaces:
            # Collapse duplicate addresses coming from multiple statements.
            seen: set[tuple[str, int]] = set()
            unique = []
            for address in interface.addresses:
                key = (address.address, address.prefix)
                if key in seen:
                    continue
                seen.add(key)
                unique.append(address)
            interface.addresses = unique


# --------------------------------------------------------------------------------------
# Renderer
# --------------------------------------------------------------------------------------


class JunosConverter(BaseConverter):
    platform = PlatformId.JUNIPER_JUNOS
    family = CliFamily.JUNOS

    def __init__(self) -> None:
        self.parser = JunosParser()

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
            add(f"set system host-name {model.hostname}")
            result.translated += 1
        if model.domain_name:
            add(f"set system domain-name {model.domain_name}")
            result.translated += 1

        if model.ssh is not None:
            add("set system services ssh")
            if model.ssh.version is not None:
                add(f"set system services ssh protocol-version v{model.ssh.version}")
            result.translated += 1
        if model.telnet is not None and model.telnet.enabled:
            self.review(
                result,
                "Telnet service",
                "Junos has no telnet service; the equivalent is a login class. "
                "Telnet access was not translated.",
                model.telnet.source_command,
            )

        for user in model.users:
            add(f'set system login user {user.name} class super-user')
            result.translated += 1
        if model.users:
            self.review(
                result,
                "Local user accounts",
                "Credentials are not portable; set them on the target after import.",
            )

        if model.name_servers:
            for server in model.name_servers:
                add(f"set system name-server {server}")
            result.translated += len(model.name_servers)
        for server in model.ntp_servers:
            add(f"set system ntp server {server.address}" + (" prefer" if server.prefer else ""))
            result.translated += 1
        for host in model.syslog_hosts:
            add(f"set system syslog host {host.address}")
            result.translated += 1
        if model.syslog_hosts:
            self.review(
                result,
                "Syslog",
                "Junos syslog files and routing are not created automatically; "
                "add the log file and routing statements you need.",
            )

        for vlan in model.vlans:
            add(f"set vlans {vlan.vlan_id}")
            if vlan.name:
                add(f'set vlans {vlan.vlan_id} name "{vlan.name}"')
            result.translated += 1

        for interface in model.interfaces:
            name = addressing.to_junos_interface(interface.name)
            if interface.description:
                add(f'set interfaces {name} description "{interface.description}"')
            if interface.mtu is not None:
                add(f"set interfaces {name} mtu {interface.mtu}")
            if interface.admin_enabled is False:
                add(f"set interfaces {name} disable")

            if interface.layer2 or interface.vlan_id is not None or interface.allowed_vlans:
                # Layer-2 port: Junos expresses this with an ethernet-switching unit.
                if interface.switchport_mode == "trunk" or interface.allowed_vlans:
                    add(f"set interfaces {name} unit 0 family ethernet-switching port-mode trunk")
                    rendered = ",".join(str(v) for v in interface.allowed_vlans)
                    if rendered:
                        add(f"set interfaces {name} unit 0 family ethernet-switching vlan members [{rendered}]")
                    self.review(
                        result,
                        "Trunk VLANs",
                        (
                            f"Trunk allowed-VLAN list ({rendered}) was carried over as a "
                            "member list. Junos also needs a native VLAN to be stated "
                            "explicitly; confirm it on the target."
                        ),
                        f"interface {interface.name}",
                    )
                else:
                    add(f"set interfaces {name} unit 0 family ethernet-switching port-mode access")
                    if interface.vlan_id is not None:
                        add(
                            f"set interfaces {name} unit 0 family ethernet-switching "
                            f"vlan members {interface.vlan_id}"
                        )
            else:
                for address in interface.addresses:
                    if not address.address:
                        continue
                    add(
                        f"set interfaces {name} unit 0 family inet address "
                        f"{address.address}/{address.prefix}"
                    )
            result.translated += 1

        for route in model.static_routes:
            if route.next_hop:
                add(
                    f"set routing-options static route {route.prefix} "
                    f"next-hop {route.next_hop}"
                )
            else:
                add(f"set routing-options static route {route.prefix}")
            result.translated += 1

        if model.ospf:
            for process in model.ospf:
                if process.router_id:
                    add(f"set protocols ospf router-id {process.router_id}")
                for network in process.networks:
                    area = network.area
                    add(f"set protocols ospf area {area} interface {network.prefix}")
                result.translated += 1
            self.review(
                result,
                "OSPF",
                "Interfaces were re-stated as area statements; verify the area types.",
            )

        if model.bgp:
            for process in model.bgp:
                add(f"set protocols bgp group CYBERSURE-IMPORT type external")
                if process.router_id:
                    add(f"set routing-options router-id {process.router_id}")
                for neighbor in process.neighbors:
                    add(
                        f"set protocols bgp group CYBERSURE-IMPORT neighbor "
                        f"{neighbor.address} remote-as {neighbor.remote_as}"
                    )
                result.translated += 1
            self.review(
                result,
                "BGP",
                "Neighbours were placed into a single import group; split groups and "
                "policy as required.",
            )

        if model.acls:
            self.require(
                result,
                "acl",
                "Access control lists",
                "Junos uses firewall filters with a different grammar; this converter "
                "does not translate ACLs automatically.",
            )
        for application in model.acl_applications:
            if application.target == "vty" and application.direction:
                add(f"set system login class CYBERSURE-IMPORT permissions")
                self.review(
                    result,
                    "Management ACL",
                    f"Access-class {application.acl_name} was not translated; add it to a "
                    "login class on the target.",
                    application.source_command,
                )

        if model.nat:
            for entry in model.nat:
                if entry.overload:
                    add(
                        f"set security nat source rule CYBERSURE-IMPORT from "
                        f"{entry.inside_source or 'any'} to any"
                    )
                    self.review(
                        result,
                        "NAT",
                        "Junos source NAT requires a destination rule too; add the "
                        "matching rule and the interfaces.",
                        entry.raw,
                    )
                else:
                    self.require(
                        result,
                        "nat",
                        "Static NAT",
                        "Junos model does not match this static NAT statement.",
                        entry.raw,
                    )
                    result.translated += 1

        if model.snmp:
            for community in model.snmp:
                access = (community.access or "ro").lower()
                add(f"set snmp community CYBERSURE-IMPORT authorization read-only")
            result.translated += len(model.snmp)
            self.review(
                result,
                "SNMP communities",
                "Community names were not carried over; define them on the target.",
            )

        if model.banner_motd:
            add(f'set system login message "{model.banner_motd}"')
            result.translated += 1

        add("commit")
        result.config = "\n".join(out).rstrip() + "\n"
        return result
