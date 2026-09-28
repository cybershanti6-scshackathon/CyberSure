"""Arista EOS converter.

EOS is Cisco-like with inline VLAN names and `username ... role ...` instead of
privilege levels, and no `ip ssh version` knob.
"""

from __future__ import annotations

import re

from app.converters.cisco_like import CiscoLikeConverter
from app.models.device import PlatformId


class AristaEOSConverter(CiscoLikeConverter):
    platform = PlatformId.ARISTA_EOS
    #: EOS uses `vlan N` / ` name X` just like NX-OS.
    vlan_name_style = "inline"
    supports_snmp = True
    supports_ospf = True
    supports_bgp = True

    def accept_line(self, line: str) -> bool:
        if re.match(r"^feature\s+", line, re.I):
            return False
        return True
