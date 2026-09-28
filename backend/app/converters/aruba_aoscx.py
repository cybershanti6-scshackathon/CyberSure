"""Aruba AOS-CX converter.

AOS-CX uses Cisco-like block syntax but addresses interfaces as `1/1/1` and
VLANs as `vlan <id>`. It has no `ip ssh version` knob and no `ip domain-name`
in the running configuration.
"""

from __future__ import annotations

import re

from app.converters.cisco_like import CiscoLikeConverter
from app.models.device import PlatformId
from app.models.network import NetworkConfig
from app.utils import addressing


class ArubaAoscxConverter(CiscoLikeConverter):
    platform = PlatformId.ARUBA_AOSCX
    vlan_name_style = "inline"
    supports_snmp = True
    supports_ospf = True
    supports_bgp = False
    supports_users = False
    supports_banner = False

    def accept_line(self, line: str) -> bool:
        if re.match(r"^feature\s+", line, re.I):
            return False
        return True

    def interface_name(self, name: str) -> str:
        return addressing.aruba_interface_name(name)
