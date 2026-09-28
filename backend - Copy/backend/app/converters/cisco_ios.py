"""Cisco IOS (classic) converter."""

from __future__ import annotations

import re

from app.converters.cisco_like import CiscoLikeConverter
from app.models.device import PlatformId


class CiscoIOSConverter(CiscoLikeConverter):
    platform = PlatformId.CISCO_IOS
    vlan_name_style = "none"
    supports_snmp = True
    supports_ospf = True
    supports_bgp = True

    def accept_line(self, line: str) -> bool:
        # NX-OS `feature` commands do not exist on classic IOS.
        if re.match(r"^feature\s+", line, re.I):
            return False
        return True
