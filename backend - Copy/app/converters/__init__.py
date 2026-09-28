"""Converter registry.

Adding a platform is a two-step change: write the converter module, then add
it to ``_CONVERTERS`` below. Nothing else in the backend or frontend needs to
know about it - the registry feeds ``GET /api/v1/devices`` and the conversion
service looks converters up by :class:`PlatformId`.
"""

from __future__ import annotations

from app.converters.arista_eos import AristaEOSConverter
from app.converters.aruba_aoscx import ArubaAoscxConverter
from app.converters.base import BaseConverter
from app.converters.cisco_asa import CiscoASAConverter
from app.converters.cisco_ios import CiscoIOSConverter
from app.converters.cisco_ios_xe import CiscoIOSXEConverter
from app.converters.cisco_nxos import CiscoNXOSConverter
from app.converters.fortinet_fortios import FortiOsConverter
from app.converters.huawei_vrp import HuaweiVrpConverter
from app.converters.juniper_junos import JunosConverter
from app.converters.mikrotik_routeros import RouterOsConverter
from app.converters.paloalto_panos import PanosConverter
from app.converters.vyos import VyosConverter
from app.models.device import PlatformId

_CONVERTERS: dict[PlatformId, type[BaseConverter]] = {
    PlatformId.CISCO_IOS: CiscoIOSConverter,
    PlatformId.CISCO_IOS_XE: CiscoIOSXEConverter,
    PlatformId.CISCO_NXOS: CiscoNXOSConverter,
    PlatformId.CISCO_ASA: CiscoASAConverter,
    PlatformId.JUNIPER_JUNOS: JunosConverter,
    PlatformId.FORTINET_FORTIOS: FortiOsConverter,
    PlatformId.PALOALTO_PANOS: PanosConverter,
    PlatformId.MIKROTIK_ROUTEROS: RouterOsConverter,
    PlatformId.ARISTA_EOS: AristaEOSConverter,
    PlatformId.HUAWEI_VRP: HuaweiVrpConverter,
    PlatformId.ARUBA_AOSCX: ArubaAoscxConverter,
    PlatformId.VYOS: VyosConverter,
}

_INSTANCES: dict[PlatformId, BaseConverter] = {}


def get_converter(platform: PlatformId) -> BaseConverter:
    """Return the shared converter instance for a platform."""
    if platform not in _INSTANCES:
        _INSTANCES[platform] = _CONVERTERS[platform]()
    return _INSTANCES[platform]


def available_platforms() -> list[PlatformId]:
    return list(_CONVERTERS.keys())


__all__ = ["get_converter", "available_platforms", "BaseConverter"]
