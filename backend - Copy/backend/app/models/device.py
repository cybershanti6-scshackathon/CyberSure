"""Platform registry.

The registry is the single source of truth for which network platforms the
converter understands. Adding a platform means writing one converter module and
registering it here - nothing else in the codebase needs to change.
"""

from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class PlatformId(str, Enum):
    CISCO_IOS = "cisco-ios"
    CISCO_IOS_XE = "cisco-iosxe"
    CISCO_NXOS = "cisco-nxos"
    CISCO_ASA = "cisco-asa"
    JUNIPER_JUNOS = "juniper-junos"
    FORTINET_FORTIOS = "fortinet-fortios"
    PALOALTO_PANOS = "paloalto-panos"
    MIKROTIK_ROUTEROS = "mikrotik-routeros"
    ARISTA_EOS = "arista-eos"
    HUAWEI_VRP = "huawei-vrp"
    ARUBA_AOSCX = "aruba-aoscx"
    VYOS = "vyos"


class CliFamily(str, Enum):
    """Shared syntax families. Platforms in the same family reuse a parser."""

    CISCO_LIKE = "cisco_like"
    JUNOS = "junos"
    FORTIOS = "fortios"
    PANOS = "panos"
    ROUTEROS = "routeros"
    HUAWEI_VRP = "huawei_vrp"
    VYOS = "vyos"


class PlatformInfo(BaseModel):
    """Serializable description of a platform for ``GET /api/v1/devices``."""

    id: str
    name: str
    vendor: str
    family: str
    cli_label: str
    file_extension: str
    description: str
    #: Concepts this platform can express; drives honest `unsupported` reporting.
    capabilities: list[str] = Field(default_factory=list)


PLATFORM_METADATA: dict[PlatformId, PlatformInfo] = {
    PlatformId.CISCO_IOS: PlatformInfo(
        id=PlatformId.CISCO_IOS.value,
        name="Cisco IOS",
        vendor="Cisco",
        family=CliFamily.CISCO_LIKE.value,
        cli_label="Classic IOS CLI",
        file_extension="cfg",
        description="Classic IOS 15.x running configuration for routers and switches.",
    ),
    PlatformId.CISCO_IOS_XE: PlatformInfo(
        id=PlatformId.CISCO_IOS_XE.value,
        name="Cisco IOS XE",
        vendor="Cisco",
        family=CliFamily.CISCO_LIKE.value,
        cli_label="IOS XE CLI",
        file_extension="cfg",
        description="IOS-XE running configuration (indent-based blocks, '!' separated).",
    ),
    PlatformId.CISCO_NXOS: PlatformInfo(
        id=PlatformId.CISCO_NXOS.value,
        name="Cisco NX-OS",
        vendor="Cisco",
        family=CliFamily.CISCO_LIKE.value,
        cli_label="NX-OS CLI",
        file_extension="cfg",
        description="NX-OS data-centre switching configuration with feature/vlan handling.",
    ),
    PlatformId.CISCO_ASA: PlatformInfo(
        id=PlatformId.CISCO_ASA.value,
        name="Cisco ASA",
        vendor="Cisco",
        family=CliFamily.CISCO_LIKE.value,
        cli_label="ASA CLI",
        file_extension="cfg",
        description="Cisco Adaptive Security Appliance with security contexts and inspection.",
    ),
    PlatformId.JUNIPER_JUNOS: PlatformInfo(
        id=PlatformId.JUNIPER_JUNOS.value,
        name="Juniper Junos",
        vendor="Juniper",
        family=CliFamily.JUNOS.value,
        cli_label="Junos set / hierarchy",
        file_extension="conf",
        description="Junos hierarchical configuration in set or brace-block form.",
    ),
    PlatformId.FORTINET_FORTIOS: PlatformInfo(
        id=PlatformId.FORTINET_FORTIOS.value,
        name="Fortinet FortiOS",
        vendor="Fortinet",
        family=CliFamily.FORTIOS.value,
        cli_label="FortiOS CLI",
        file_extension="conf",
        description="FortiGate configuration in config/edit/next block form.",
    ),
    PlatformId.PALOALTO_PANOS: PlatformInfo(
        id=PlatformId.PALOALTO_PANOS.value,
        name="Palo Alto PAN-OS",
        vendor="Palo Alto Networks",
        family=CliFamily.PANOS.value,
        cli_label="PAN-OS CLI",
        file_extension="cfg",
        description="PAN-OS device and interface configuration with security policy.",
    ),
    PlatformId.MIKROTIK_ROUTEROS: PlatformInfo(
        id=PlatformId.MIKROTIK_ROUTEROS.value,
        name="MikroTik RouterOS",
        vendor="MikroTik",
        family=CliFamily.ROUTEROS.value,
        cli_label="RouterOS export",
        file_extension="rsc",
        description="RouterOS export format with path-style commands.",
    ),
    PlatformId.ARISTA_EOS: PlatformInfo(
        id=PlatformId.ARISTA_EOS.value,
        name="Arista EOS",
        vendor="Arista",
        family=CliFamily.CISCO_LIKE.value,
        cli_label="EOS CLI",
        file_extension="cfg",
        description="Arista EOS leaf/spine switching configuration.",
    ),
    PlatformId.HUAWEI_VRP: PlatformInfo(
        id=PlatformId.HUAWEI_VRP.value,
        name="Huawei VRP",
        vendor="Huawei",
        family=CliFamily.HUAWEI_VRP.value,
        cli_label="VRP CLI",
        file_extension="cfg",
        description="Huawei Versatile Routing Platform configuration.",
    ),
    PlatformId.ARUBA_AOSCX: PlatformInfo(
        id=PlatformId.ARUBA_AOSCX.value,
        name="Aruba AOS-CX",
        vendor="Aruba",
        family=CliFamily.CISCO_LIKE.value,
        cli_label="AOS-CX CLI",
        file_extension="cfg",
        description="Aruba AOS-CX campus switching configuration.",
    ),
    PlatformId.VYOS: PlatformInfo(
        id=PlatformId.VYOS.value,
        name="VyOS",
        vendor="Vyatta",
        family=CliFamily.VYOS.value,
        cli_label="VyOS CLI",
        file_extension="cfg",
        description="VyOS virtual router configuration in set form.",
    ),
}


def resolve_platform(value: str) -> Optional[PlatformId]:
    """Map a user-supplied string onto a PlatformId, or ``None`` when unknown."""
    if not value:
        return None
    text = value.strip().lower()
    for platform in PlatformId:
        if platform.value == text:
            return platform
    # Tolerate a few common aliases so API clients are not brittle.
    alias = text.replace(" ", "-").replace("_", "-")
    for platform in PlatformId:
        if platform.value == alias:
            return platform
    # Spelling variants clients reach for. The canonical ids above stay
    # authoritative and are what GET /api/v1/devices advertises.
    return {"cisco-ios-xe": PlatformId.CISCO_IOS_XE}.get(alias)


def list_platforms() -> list[PlatformId]:
    """Every registered platform id, in registration order."""
    return list(PLATFORM_METADATA.keys())


def platform_info(platform_id: PlatformId) -> PlatformInfo:
    """Display metadata for a single platform."""
    return PLATFORM_METADATA[platform_id]
