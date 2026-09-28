"""Cisco NX-OS converter.

NX-OS is Cisco-like but differs in two visible ways: VLANs carry a `name`
sub-line under the `vlan` statement, and switching features must be enabled
with `feature <name>`.
"""

from __future__ import annotations

from app.converters.cisco_like import CiscoLikeConverter
from app.models.device import PlatformId

#: Features required for a given capability on NX-OS.
NXOS_FEATURE_FOR_CAPABILITY = {
    "ospf": "ospf",
    "bgp": "bgp",
    "acl": "acl",
    "nat": "nat",
    "vlan": "vlan",
    "interfaces": "interface-vlan",
}


class CiscoNXOSConverter(CiscoLikeConverter):
    platform = PlatformId.CISCO_NXOS
    #: NX-OS uses the `vlan N` / ` name X` sub-line form.
    vlan_name_style = "inline"
    supports_snmp = True
    supports_ospf = True
    supports_bgp = True

    def render(self, model):
        from app.models.network import NetworkConfig
        import copy

        enriched = model.model_copy(deep=True)
        required: list[str] = []

        if enriched.interfaces:
            required.append("interface-vlan")
        if enriched.ospf:
            required.append("ospf")
        if enriched.bgp:
            required.append("bgp")
        if enriched.acls or enriched.acl_applications:
            required.append("acl")
        if enriched.nat:
            required.append("nat")
        if enriched.vlans:
            required.append("vlan")

        for feature in required:
            if feature not in enriched.features:
                enriched.features.insert(0, feature)
        del copy, NetworkConfig
        return super().render(enriched)
