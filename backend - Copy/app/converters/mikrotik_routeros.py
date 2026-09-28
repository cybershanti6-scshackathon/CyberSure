"""MikroTik RouterOS converter.

RouterOS exports are path-style: `/interface bridge` headers followed by
`add`/`set` lines.
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
    UnparsedCommand,
)
from app.utils import addressing

def _pairs(line: str) -> dict[str, str]:
    """Parse RouterOS ``key=value`` pairs out of one command line.

    Values may be quoted and may contain spaces, so the scanner tracks quotes
    rather than splitting on whitespace.
    """
    result: dict[str, str] = {}
    for match in re.finditer(r'([A-Za-z][\w-]*)=("(?:[^"\\]|\\.)*"|\'[^\']*\'|[^\s]*)', line):
        value = match.group(2)
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
            value = value[1:-1]
        result[match.group(1).lower()] = value
    return result


class RouterOsParser:
    def parse(self, text: str) -> ParseResult:
        model = NetworkConfig()
        lines = text.splitlines()
        ignored = 0
        path: Optional[str] = None

        for index, raw in enumerate(lines):
            line_number = index + 1
            stripped = raw.strip()
            if not stripped or stripped.startswith("#"):
                ignored += 1
                continue

            if stripped.startswith("/"):
                path = stripped[1:].strip()
                continue

            if path is None:
                model.unparsed.append(
                    UnparsedCommand(raw=stripped, line=line_number, reason="Statement outside a path block")
                )
                continue

            if not self._apply(model, path, stripped, line_number):
                model.unparsed.append(
                    UnparsedCommand(raw=stripped, line=line_number, reason=f"Unrecognised RouterOS statement in /{path}")
                )
        return ParseResult(config=model, ignored_lines=ignored)

    def _apply(self, model: NetworkConfig, path: str, line: str, line_number: int) -> bool:
        # Split the command verb from its key=value arguments.
        verb, _, rest = line.partition(" ")
        verb = verb.lower()
        args = _pairs(rest)

        if path == "system identity" and args.get("name"):
            model.hostname = args["name"]
            return True
        if path == "system clock" and verb == "set":
            return True
        if path == "system ntp client":
            if verb != "set":
                return True
            if args.get("primary-ntp"):
                model.ntp_servers.append(NtpServer(address=args["primary-ntp"]))
                return True
            if args.get("secondary-ntp"):
                model.ntp_servers.append(NtpServer(address=args["secondary-ntp"]))
                return True
            return True
        if path == "ip dns":
            if args.get("servers"):
                for server in args["servers"].split(","):
                    server = server.strip()
                    if server and server not in model.name_servers:
                        model.name_servers.append(server)
                return True
            return True
        if path == "ip service":
            for key, value in args.items():
                if key == "telnet":
                    from app.models.network import TelnetServer

                    model.telnet = TelnetServer(
                        enabled=value.lower() != "disabled", source_command=line
                    )
                    return True
                if key == "ssh":
                    if value.lower() == "disabled":
                        model.ssh = None
                    else:
                        model.ssh = model.ssh or SshServer(version=2)
                    return True
            # A `set` with no recognised key is not understood.
            return verb == "set" and bool(args)
        if path == "ip address" and verb == "add":
            cidr = addressing.split_cidr(args.get("address", ""))
            name = args.get("interface")
            if cidr is None or not name:
                return False
            interface = self._interface(model, name)
            interface.addresses.append(Address(address=cidr[0], prefix=cidr[1]))
            return True
        if path.startswith("interface/"):
            if verb == "set" and args.get("comment"):
                interface = self._interface(model, args.get("name") or args.get(".id") or "ether1")
                interface.description = args["comment"]
                return True
            if args.get("name"):
                interface = self._interface(model, args["name"])
                if args.get("mtu", "").isdigit():
                    interface.mtu = int(args["mtu"])
                return True
            return False
        if path == "ip route" and verb == "add":
            from app.models.network import StaticRoute

            model.static_routes.append(
                StaticRoute(
                    prefix=args.get("dst-address", "0.0.0.0/0"),
                    next_hop=args.get("gateway"),
                    interface=args.get("interface"),
                    source_command=line,
                )
            )
            return True
        if path == "system script" or path == "system scheduler":
            return True
        if path.startswith("ip firewall"):
            model.partial.append(line)
            return True
        if path.startswith("routing bgp") or path.startswith("routing ospf"):
            model.partial.append(line)
            return True
        if path == "snmp":
            return False
        return False

    @staticmethod
    def _interface(model: NetworkConfig, name: str) -> Interface:
        existing = model.interface(name)
        if existing is not None:
            return existing
        created = Interface(name=name)
        model.interfaces.append(created)
        return created


class RouterOsConverter(BaseConverter):
    platform = PlatformId.MIKROTIK_ROUTEROS
    family = CliFamily.ROUTEROS

    def __init__(self) -> None:
        self.parser = RouterOsParser()

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
            add("/system identity")
            add(f"set name={model.hostname}")
            add("")
            result.translated += 1

        for interface in model.interfaces:
            add("/interface ethernet")
            name = interface.name or "ether1"
            add(f"add name={name}" + (f" mtu={interface.mtu}" if interface.mtu else ""))
            if interface.description:
                add(f'set {name} comment="{interface.description}"')
            add("")
            result.translated += 1

        for interface in model.interfaces:
            if not interface.addresses:
                continue
            add("/ip address")
            for address in interface.addresses:
                if ":" in address.address:
                    continue
                add(
                    f"add address={address.address}/{address.prefix} "
                    f"interface={interface.name}"
                )
            add("")
        if any(interface.addresses for interface in model.interfaces):
            result.translated += 1

        for route in model.static_routes:
            add("/ip route")
            add(f"add dst-address={route.prefix}" + (f" gateway={route.next_hop}" if route.next_hop else ""))
            add("")
            result.translated += 1

        if model.name_servers:
            add("/ip dns")
            add(f"set servers={','.join(model.name_servers)}")
            add("")
            result.translated += 1

        if model.ntp_servers:
            add("/system ntp client")
            add("set enabled=yes")
            for index, server in enumerate(model.ntp_servers):
                add(f"set {'primary' if index == 0 else 'secondary'}-ntp={server.address}")
            add("")
            result.translated += len(model.ntp_servers)

        add("/ip service")
        add("set telnet=disabled")
        if model.ssh is not None:
            add("set ssh=enabled")
        else:
            add("set ssh=disabled")
        add("set www=disabled")
        add("set api=disabled")
        add("")

        if model.ssh is not None:
            self.review(
                result,
                "SSH",
                "RouterOS enables SSH as a service rather than a versioned statement; "
                "restrict the allowed address list on the target.",
            )
        if model.telnet is not None and model.telnet.enabled:
            self.review(
                result,
                "Telnet service",
                "Telnet was disabled in the rendered output; confirm that is intended.",
                model.telnet.source_command,
            )

        if model.acls or model.partial:
            self.require(
                result,
                "acl",
                "Firewall rules",
                "RouterOS firewall chains are not translated automatically.",
            )

        if model.ospf or model.bgp:
            self.require(
                result,
                "dynamic-routing",
                "Dynamic routing",
                "RouterOS routing protocols require instance and template setup.",
            )

        if model.snmp:
            self.require(
                result,
                "snmp",
                "SNMP communities",
                "RouterOS SNMP is enabled with /snmp set community plus an address list.",
            )

        result.config = "\n".join(out).rstrip() + "\n"
        return result
