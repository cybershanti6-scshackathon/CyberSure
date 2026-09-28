"""Cisco IOS XE converter."""

from __future__ import annotations

import re

from app.converters.cisco_like import CiscoLikeConverter
from app.models.device import PlatformId


class CiscoIOSXEConverter(CiscoLikeConverter):
    platform = PlatformId.CISCO_IOS_XE
    vlan_name_style = "none"
    supports_snmp = True
    supports_ospf = True
    supports_bgp = True

    def accept_line(self, line: str) -> bool:
        # `feature` is an NX-OS/Arista construct, not IOS XE.
        if re.match(r"^feature\s+", line, re.I):
            return False
        return True
