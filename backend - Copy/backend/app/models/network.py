"""The normalized network configuration model.

Every platform parser produces this structure and every platform renderer
consumes it. Keeping one intermediate representation is what makes *any*
source platform convertible to *any* target platform: Cisco NX-OS -> Junos and
RouterOS -> PAN-OS travel exactly the same path.

Anything a parser cannot confidently understand is preserved in
``unparsed`` rather than being dropped or guessed at.
"""

from __future__ import annotations

import re
from typing import Literal, Optional

from pydantic import BaseModel, Field

# --------------------------------------------------------------------------------------
# Leaf structures
# --------------------------------------------------------------------------------------


class Address(BaseModel):
    """An IPv4/IPv6 address bound to an interface."""

    address: str
    prefix: int
    secondary: bool = False


class Interface(BaseModel):
    """A routed or switched interface."""

    name: str
    description: Optional[str] = None
    addresses: list[Address] = Field(default_factory=list)
    mtu: Optional[int] = None
    # ``None`` means "not stated by the source"; True/False means stated.
    admin_enabled: Optional[bool] = None
    layer2: bool = False
    switchport_mode: Optional[Literal["access", "trunk"]] = None
    vlan_id: Optional[int] = None
    allowed_vlans: list[int] = Field(default_factory=list)
    channel_group: Optional[str] = None
    shutdown_reason: Optional[str] = None


class Vlan(BaseModel):
    vlan_id: int
    name: Optional[str] = None


class StaticRoute(BaseModel):
    prefix: str
    next_hop: Optional[str] = None
    interface: Optional[str] = None
    distance: Optional[int] = None
    source_command: Optional[str] = None


class OspfNetwork(BaseModel):
    prefix: str
    area: str = "0.0.0.0"


class OspfProcess(BaseModel):
    process_id: str
    router_id: Optional[str] = None
    networks: list[OspfNetwork] = Field(default_factory=list)


class BgpNeighbor(BaseModel):
    address: str
    remote_as: str
    description: Optional[str] = None


class BgpProcess(BaseModel):
    asn: str
    router_id: Optional[str] = None
    neighbors: list[BgpNeighbor] = Field(default_factory=list)
    networks: list[str] = Field(default_factory=list)


class AclEntry(BaseModel):
    """One access-control entry, either extended/named or a numbered standard rule."""

    acl_name: str
    sequence: Optional[int] = None
    action: Literal["permit", "deny"]
    protocol: Optional[str] = None
    source: Optional[str] = None
    source_wildcard: Optional[str] = None
    destination: Optional[str] = None
    destination_wildcard: Optional[str] = None
    raw: str
    source_command: Optional[str] = None
    #: The statement that opened the list, e.g. `ip access-list extended MGMT`.
    definition: Optional[str] = None


class NatEntry(BaseModel):
    nat_type: Literal["source", "destination"]
    inside_source: Optional[str] = None
    translation: str
    overload: bool = False
    interface: Optional[str] = None
    raw: str


class SshServer(BaseModel):
    version: Optional[int] = None
    timeout: Optional[int] = None
    retries: Optional[int] = None
    domains: list[str] = Field(default_factory=list)
    root_login: Optional[bool] = None


class TelnetServer(BaseModel):
    enabled: bool = True
    access_class: Optional[str] = None
    source_command: Optional[str] = None


class SnmpCommunity(BaseModel):
    community: str
    access: Optional[Literal["ro", "rw"]] = None
    source_command: Optional[str] = None


class NtpServer(BaseModel):
    address: str
    key: Optional[int] = None
    prefer: bool = False
    source_command: Optional[str] = None


class SyslogHost(BaseModel):
    address: str
    level: Optional[str] = None
    facility: Optional[str] = None


class UserAccount(BaseModel):
    name: str
    privilege: Optional[int] = None
    role: Optional[str] = None
    secret_set: bool = False
    source_command: Optional[str] = None


class AclApplication(BaseModel):
    """Where an ACL is applied: interface, line vty, nat, etc."""

    target: str
    direction: Optional[str] = None
    acl_name: str
    source_command: Optional[str] = None


# --------------------------------------------------------------------------------------
# Conversion issue records
# --------------------------------------------------------------------------------------


class UnparsedCommand(BaseModel):
    """A line the parser could not interpret. Never silently discarded."""

    raw: str
    line: int
    reason: str


class RenderIssue(BaseModel):
    """Something the target platform could not express faithfully.

    ``status`` is one of:

    * ``unsupported``  - the target platform has no equivalent construct
    * ``requires_review`` - a translation exists but cannot be proven equivalent
    """

    status: Literal["unsupported", "requires_review"]
    concept: str
    detail: str
    source_command: Optional[str] = None
    original_line: Optional[str] = None


# --------------------------------------------------------------------------------------
# The model itself
# --------------------------------------------------------------------------------------


class NetworkConfig(BaseModel):
    """Normalized representation produced by every parser."""

    # System
    hostname: Optional[str] = None
    domain_name: Optional[str] = None
    banner_motd: Optional[str] = None
    banner_login: Optional[str] = None
    features: list[str] = Field(default_factory=list)
    software_version: Optional[str] = None

    # L2/L3
    interfaces: list[Interface] = Field(default_factory=list)
    vlans: list[Vlan] = Field(default_factory=list)

    # Routing
    static_routes: list[StaticRoute] = Field(default_factory=list)
    ospf: list[OspfProcess] = Field(default_factory=list)
    bgp: list[BgpProcess] = Field(default_factory=list)

    # Security
    acls: list[AclEntry] = Field(default_factory=list)
    acl_applications: list[AclApplication] = Field(default_factory=list)
    nat: list[NatEntry] = Field(default_factory=list)

    # Services
    name_servers: list[str] = Field(default_factory=list)
    ntp_servers: list[NtpServer] = Field(default_factory=list)
    syslog_hosts: list[SyslogHost] = Field(default_factory=list)
    logging_buffered_size: Optional[int] = None
    logging_level: Optional[str] = None
    ssh: Optional[SshServer] = None
    telnet: Optional[TelnetServer] = None
    snmp: list[SnmpCommunity] = Field(default_factory=list)
    users: list[UserAccount] = Field(default_factory=list)
    password_encryption: Optional[bool] = None

    # Bookkeeping
    unparsed: list[UnparsedCommand] = Field(default_factory=list)
    #: Concepts this parser recognised but deliberately did not model.
    #: Renderers turn these into `requires_review` items.
    partial: list[str] = Field(default_factory=list)

    # -- convenience helpers -------------------------------------------------------

    def interface(self, name: str) -> Optional[Interface]:
        """Case-insensitive interface lookup."""
        lowered = name.lower()
        for interface in self.interfaces:
            if interface.name.lower() == lowered:
                return interface
        return None

    def vlan(self, vlan_id: int) -> Optional[Vlan]:
        for vlan in self.vlans:
            if vlan.vlan_id == vlan_id:
                return vlan
        return None

    def is_empty(self) -> bool:
        """True when nothing meaningful was extracted."""
        return not any(
            [
                self.hostname,
                self.domain_name,
                self.interfaces,
                self.vlans,
                self.static_routes,
                self.ospf,
                self.bgp,
                self.acls,
                self.nat,
                self.name_servers,
                self.ntp_servers,
                self.syslog_hosts,
                self.ssh,
                self.telnet,
                self.snmp,
                self.users,
                self.banner_motd,
                self.banner_login,
            ]
        )

    def referenced_vlan_ids(self) -> set[int]:
        """Every VLAN id an interface or SVI actually points at."""
        referenced: set[int] = set()
        for interface in self.interfaces:
            if interface.vlan_id is not None:
                referenced.add(interface.vlan_id)
            referenced.update(interface.allowed_vlans)
            match = re.match(r"^(?:vlan|vlanif)(\d+)$", interface.name.strip(), re.I)
            if match:
                referenced.add(int(match.group(1)))
        return referenced

    def ensure_referenced_vlans(self) -> list[int]:
        """Materialise VLAN definitions implied by access/trunk references.

        Classic IOS never declares a VLAN in the running configuration - the
        ``switchport access vlan 30`` line is the whole truth. Renderers on other
        platforms need the VLAN to exist, so it is recorded here (with no
        invented name) rather than silently dropped.
        """
        added: list[int] = []
        for vlan_id in sorted(self.referenced_vlan_ids()):
            if vlan_id <= 0 or vlan_id > 4094:
                continue
            if self.vlan(vlan_id) is None:
                self.vlans.append(Vlan(vlan_id=vlan_id))
                added.append(vlan_id)
        return added
