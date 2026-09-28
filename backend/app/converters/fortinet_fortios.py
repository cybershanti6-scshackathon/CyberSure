"""Fortinet FortiOS converter.

FortiOS is block-structured (`config <block>` / `edit "<object>"` / `set` /
`next` / `end`). This module parses that grammar and renders it back out.
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
    SnmpCommunity,
    SshServer,
    StaticRoute,
    SyslogHost,
    UnparsedCommand,
)
from app.utils import addressing


class FortiOsParser:
    """Parses FortiOS block configuration into the normalized model.

    FortiOS nests three ways::

        config system global        <- block
            set hostname "fw01"     <- block-level setting
        end
        config system interface     <- block
            edit "port1"            <- object
                set ip 10.0.0.1 ... <- object setting
            next
        end

    A single pass tracks block and object state, so both forms are handled.
    """

    def parse(self, text: str) -> ParseResult:
        model = NetworkConfig()
        ignored = 0
        block: Optional[str] = None
        edit: Optional[str] = None
        settings: dict[str, str] = {}

        def flush_object() -> None:
            if edit is not None and block is not None:
                self._apply_object(model, block, edit, settings)
            settings.clear()

        for index, raw in enumerate(text.splitlines()):
            line_number = index + 1
            stripped = raw.strip()
            if not stripped or stripped.startswith("#"):
                ignored += 1
                continue
            if stripped.startswith("config "):
                flush_object()
                edit = None
                block = stripped.split(None, 1)[1].strip().lower()
                continue
            if stripped == "end":
                flush_object()
                edit = None
                block = None
                continue
            if stripped.startswith("edit "):
                flush_object()
                edit = stripped.split(None, 1)[1].strip().strip('"')
                continue
            if stripped in {"next", "leave"}:
                flush_object()
                edit = None
                continue
            if not stripped.startswith("set "):
                model.unparsed.append(
                    UnparsedCommand(
                        raw=stripped,
                        line=line_number,
                        reason=f"Unsupported FortiOS statement in block '{block or 'top level'}'",
                    )
                )
                continue

            payload = stripped[4:].strip()
            if not payload:
                continue
            key, _, value = payload.partition(" ")
            key = key.strip().lower()
            value = value.strip().strip('"')

            if edit is not None:
                settings[key] = value
                continue

            if not self._apply_block(model, block, key, value, stripped):
                model.unparsed.append(
                    UnparsedCommand(
                        raw=stripped,
                        line=line_number,
                        reason=f"Unrecognised setting '{key}' in block '{block or 'top level'}'",
                    )
                )

        flush_object()
        return ParseResult(config=model, ignored_lines=ignored)

    # -- block-level settings ----------------------------------------------------

    def _apply_block(
        self, model: NetworkConfig, block: Optional[str], key: str, value: str, raw: str
    ) -> bool:
        if block == "system global":
            if key == "hostname":
                model.hostname = value
                return True
            if key == "admin-ssh-port":
                model.ssh = model.ssh or SshServer()
                model.ssh.version = 2
                return True
            if key == "admin-sshpublickey":
                model.partial.append(raw)
                return True
            return False
        if block == "system dns":
            if key in {"primary-dns", "secondary-dns"} and value:
                if value not in model.name_servers:
                    model.name_servers.append(value)
                return True
            return False
        if block == "system ntp":
            if key == "ntpserver" and value:
                model.ntp_servers.append(NtpServer(address=value))
                return True
            if key == "ntpsync":
                return True
            return False
        if block == "log setting":
            if key in {"fwserver", "fwserver-ipv6"} and value:
                model.syslog_hosts.append(SyslogHost(address=value))
                return True
            return False
        if block == "system snmp-community":
            # Community objects are handled in the object pass.
            return True
        if block in {"firewall policy", "firewall address", "firewall ippool",
                     "firewall vip", "system replacemsg", "system password-policy"}:
            model.partial.append(raw)
            return True
        return False

    # -- object-level settings ----------------------------------------------------

    def _apply_object(
        self, model: NetworkConfig, block: str, name: str, settings: dict[str, str]
    ) -> None:
        if block == "system interface":
            interface = _interface(model, name)
            if "description" in settings:
                interface.description = settings["description"]
            if "ip" in settings and ":" not in settings["ip"]:
                mask = settings.get("netmask")
                prefix = addressing.mask_to_prefix(mask) if mask else 24
                interface.addresses.append(Address(address=settings["ip"], prefix=prefix))
            if "status" in settings:
                interface.admin_enabled = settings["status"].lower() == "up"
            if "mtu" in settings:
                try:
                    interface.mtu = int(settings["mtu"])
                except ValueError:
                    pass
            if "mode" in settings and settings["mode"].lower() == "dhcp":
                model.partial.append(f"config system interface / edit \"{name}\" / set mode dhcp")
            return
        if block == "system vlan":
            if not name.isdigit():
                return
            vlan_id = int(name)
            vlan = model.vlan(vlan_id)
            if vlan is None:
                from app.models.network import Vlan

                vlan = Vlan(vlan_id=vlan_id)
                model.vlans.append(vlan)
            if "vlan-name" in settings:
                vlan.name = settings["vlan-name"]
            return
        if block == "router static":
            if not name.isdigit():
                return
            prefix = settings.get("dst", settings.get("dst-addr", "0.0.0.0/0"))
            route = StaticRoute(prefix=prefix, next_hop=settings.get("gateway"))
            if "device" in settings:
                route.interface = settings["device"]
            if "distance" in settings:
                try:
                    route.distance = int(settings["distance"])
                except ValueError:
                    pass
            model.static_routes.append(route)
            return
        if block == "system snmp-community":
            access = "rw" if "1" in settings.get("rw", "") or "1" in settings.get("ro", "") else "ro"
            model.snmp.append(
                SnmpCommunity(
                    community=name,
                    access="rw" if settings.get("ro", "0") == "0" and "rw" in settings else "ro",
                    source_command=f"config system snmp-community / edit \"{name}\"",
                )
            )
            del access
            return
        if block in {"firewall address", "firewall policy", "firewall vip", "firewall ippool"}:
            model.partial.append(f"config {block} / edit \"{name}\"")
            return


def _interface(model: NetworkConfig, name: str) -> "Interface":
    """Fetch or create an interface by name."""
    existing = model.interface(name)
    if existing is not None:
        return existing
    created = Interface(name=name)
    model.interfaces.append(created)
    return created


class FortiOsConverter(BaseConverter):
    platform = PlatformId.FORTINET_FORTIOS
    family = CliFamily.FORTIOS

    def __init__(self) -> None:
        self.parser = FortiOsParser()

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

        if model.hostname or model.domain_name or (model.ssh and model.ssh.version):
            add("config system global")
            if model.hostname:
                add(f'    set hostname "{model.hostname}"')
                result.translated += 1
            if model.domain_name:
                suffix = ".".join(str(model.domain_name).split(".")[-2:])
                add(f'    set dns suffix "{suffix}"')
                self.review(
                    result,
                    "Domain name",
                    f"FortiOS accepts a two-label DNS suffix; the source domain "
                    f"'{model.domain_name}' was shortened to '{suffix}'.",
                )
            if model.ssh is not None:
                add("    set admin-ssh-port 22")
                self.review(
                    result,
                    "SSH",
                    "FortiOS enables SSH on the admin profile rather than in the "
                    "running configuration; enable it on the administrator account.",
                )
            add("end")
            add("")

        if model.name_servers:
            add("config system dns")
            add(f"    set primary-dns {model.name_servers[0]}")
            for server in model.name_servers[1:2]:
                add(f"    set secondary-dns {server}")
            add("end")
            add("")
            result.translated += 1

        if model.ntp_servers:
            add("config system ntp")
            add("    set ntpsync enable")
            for index, server in enumerate(model.ntp_servers, start=1):
                add(f"    set ntpserver {index} {server.address}")
            add("end")
            add("")
            result.translated += len(model.ntp_servers)

        if model.syslog_hosts:
            add("config log setting")
            for host in model.syslog_hosts:
                add(f"    set fwserver {host.address}")
            add("end")
            add("")
            result.translated += len(model.syslog_hosts)

        for interface in model.interfaces:
            port = addressing.fortios_port_name(interface.name)
            add("config system interface")
            add(f'    edit "{port}"')
            if interface.description:
                add(f'        set description "{interface.description}"')
            for address in interface.addresses:
                if ":" in address.address:
                    continue
                add(f"        set ip {address.address} {addressing.prefix_to_mask(address.prefix)}")
            if interface.mtu is not None:
                add(f"        set mtu {interface.mtu}")
            if interface.admin_enabled is False:
                add("        set status down")
            add("    next")
            add("end")
            add("")
            result.translated += 1

        for vlan in model.vlans:
            add("config system vlan")
            add(f'    edit "{vlan.vlan_id}"')
            if vlan.name:
                add(f'        set vlan-name "{vlan.name}"')
            add("    next")
            add("end")
            add("")
            result.translated += 1

        for route in model.static_routes:
            add("config router static")
            add("    edit 0")
            if route.next_hop:
                add(f"        set gateway {route.next_hop}")
            else:
                add("        set gateway 0.0.0.0")
            if route.interface:
                add(f"        set device {addressing.fortios_port_name(route.interface)}")
            add("    next")
            add("end")
            add("")
            result.translated += 1
            self.review(
                result,
                "Static route",
                "Confirm the egress interface and the administrative distance on the "
                "FortiGate.",
            )

        if model.acls or model.acl_applications:
            self.require(
                result,
                "acl",
                "Access control lists",
                "FortiOS policies combine address, service and action objects. This "
                "converter does not build policy objects automatically.",
            )

        if model.nat:
            for entry in model.nat:
                if entry.overload:
                    add("config firewall ippool")
                    add('    edit "CYBERSURE-SNAT"')
                    add("        set type one-to-one")
                    add("    next")
                    add("end")
                    add("")
                self.review(
                    result,
                    "NAT",
                    "Create the central SNAT policy referencing the correct outgoing "
                    "interface and IP pool.",
                    entry.raw,
                )
                result.translated += 1

        if model.ospf or model.bgp:
            self.require(
                result,
                "dynamic-routing",
                "Dynamic routing",
                f"FortiOS routing is configured under `config router ospf` / "
                f"`config router bgp` with policy requirements; not translated here.",
            )

        if model.snmp:
            for community in model.snmp:
                access = (community.access or "ro").lower()
                add("config system snmp-community")
                add(f'    edit "{community.community}"')
                add("        config v1")
                add(f"            set {access} 1")
                add("        end")
                add("    next")
                add("end")
                add("")
            result.translated += len(model.snmp)
            self.review(
                result,
                "SNMP communities",
                "Restrict each community to the management Vlan after import.",
            )

        result.config = "\n".join(out).rstrip() + "\n"
        return result
