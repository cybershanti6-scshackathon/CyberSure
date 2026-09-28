"""IPv4/IPv6 addressing helpers shared by every platform converter.

All conversions between dotted masks and prefix lengths live here so that the
individual platform modules never re-implement the same arithmetic.
"""

from __future__ import annotations

import ipaddress
import re
from typing import Optional

# --------------------------------------------------------------------------------------
# IPv4 <-> prefix length
# --------------------------------------------------------------------------------------


def mask_to_prefix(mask: str) -> int:
    """Convert a dotted-decimal subnet mask to a prefix length.

    Falls back to /24 when the mask is malformed or non-contiguous, so a bad
    input never silently produces a wrong network.
    """
    try:
        return ipaddress.IPv4Network(f"0.0.0.0/{mask}").prefixlen
    except (ValueError, ipaddress.AddressValueError, ipaddress.NetmaskValueError):
        return 24


def prefix_to_mask(prefix: int) -> str:
    """Convert a prefix length to a dotted-decimal subnet mask."""
    prefix = max(0, min(32, int(prefix)))
    value = (0xFFFFFFFF << (32 - prefix)) & 0xFFFFFFFF
    return ".".join(str((value >> shift) & 0xFF) for shift in (24, 16, 8, 0))


def cidr_to_mask_cidr(value: str) -> Optional[str]:
    """Normalise ``addr/prefix`` input, returning ``None`` when unusable."""
    try:
        return str(ipaddress.ip_interface(value))
    except ValueError:
        return None


def is_ipv4(value: str) -> bool:
    try:
        ipaddress.IPv4Address(value)
        return True
    except (ipaddress.AddressValueError, ValueError):
        return False


# --------------------------------------------------------------------------------------
# Interface name normalisation
# --------------------------------------------------------------------------------------

#: Maps a vendor interface prefix onto the short form used by Junos / EOS / AOS-CX.
JUNOS_PREFIX_ALIASES: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"^tengigabitethernet$", re.I), "xe"),
    (re.compile(r"^fortygigabitethernet$", re.I), "et"),
    (re.compile(r"^hundredgigabitethernet$", re.I), "et"),
    (re.compile(r"^twentyfivegige$", re.I), "xe"),
    (re.compile(r"^fortygige$", re.I), "et"),
    (re.compile(r"^hundredgige$", re.I), "et"),
    (re.compile(r"^tengige$", re.I), "xe"),
    (re.compile(r"^gigabitethernet$", re.I), "ge"),
    (re.compile(r"^fastethernet$", re.I), "fe"),
    (re.compile(r"^ethernet(\d|$)", re.I), "ge"),
    (re.compile(r"^management\d*$", re.I), "em"),
    (re.compile(r"^loopback\d*$", re.I), "lo"),
    (re.compile(r"^vlan(\d|$)", re.I), "ge"),
]

#: Reverse mapping (short form -> vendor prefix) used when rendering Cisco-style output.
CISCO_PREFIX_ALIASES: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"^xe-", re.I), "TenGigabitEthernet"),
    (re.compile(r"^et-", re.I), "TenGigabitEthernet"),
    (re.compile(r"^ge-", re.I), "GigabitEthernet"),
    (re.compile(r"^fe-", re.I), "FastEthernet"),
    (re.compile(r"^em", re.I), "Management"),
    (re.compile(r"^lo", re.I), "Loopback"),
    (re.compile(r"^irb", re.I), "Vlan"),
]

_NAME_AND_SLOT = re.compile(r"^(.*?)(\d+(?:[/:]\d+)*)$")


def split_interface_name(name: str) -> tuple[str, str, str]:
    """Split ``GigabitEthernet0/1`` into ``("GigabitEthernet", "0", "1")``.

    Names without a trailing number (``Port-channel1`` handled elsewhere) fall
    back to a synthetic slot/port pair so callers always get three parts.
    """
    cleaned = name.strip()
    match = _NAME_AND_SLOT.match(cleaned)
    if not match:
        return cleaned, "0", "0"
    numbers = re.split(r"[/:]", match.group(2))
    numbers = [n for n in numbers if n != ""] or ["0", "0"]
    port = numbers[-1]
    slot = "/".join(numbers[:-1]) or "0"
    prefix = re.sub(r"[-_\s]+$", "", match.group(1))
    return prefix, slot, port


def to_junos_interface(name: str) -> str:
    """``GigabitEthernet0/1`` -> ``ge-0/0/1``."""
    prefix, slot, port = split_interface_name(name)
    alias = next((a for pattern, a in JUNOS_PREFIX_ALIASES if pattern.match(prefix)), "ge")
    pic = slot if "/" in slot else f"{slot}/0"
    return f"{alias}-{pic}/{port}"


def to_cisco_interface(name: str) -> str:
    """``ge-0/0/1`` -> ``GigabitEthernet0/0/1``. Passes vendor names through."""
    cleaned = name.strip()
    if "-" not in cleaned:
        return cleaned
    alias = next((a for pattern, a in CISCO_PREFIX_ALIASES if pattern.match(cleaned)), None)
    if alias is None:
        return cleaned
    return f"{alias}{cleaned[cleaned.index('-') + 1:]}"


def interface_numbers(name: str) -> list[int]:
    """All numeric components of an interface name, in order.

    ``GigabitEthernet1/0/10`` -> ``[1, 0, 10]``; ``Loopback0`` -> ``[0]``.
    """
    numbers: list[int] = []
    for token in re.findall(r"\d+", name):
        numbers.append(int(token))
    return numbers or [0]


def to_generic_interface(name: str) -> str:
    """Normalise any interface name to a bare ``ethernetX/Y/Z`` style token.

    Used by firewall platforms (FortiOS/PAN-OS) that model physical ports
    independently of the source platform's naming.
    """
    numbers = interface_numbers(name)
    return "ethernet" + "/".join(str(number) for number in numbers)


def fortios_port_name(name: str) -> str:
    """``GigabitEthernet0/1`` -> ``port1``; ``GigabitEthernet1/0/1`` -> ``port11``."""
    numbers = interface_numbers(name)
    if len(numbers) >= 3:
        return f"port{numbers[0]}{numbers[-1]}"
    return f"port{numbers[0] * 10 + numbers[1]}" if len(numbers) == 2 else f"port{numbers[0]}"


def vyos_interface_name(name: str) -> str:
    """VyOS addresses interfaces as ``ethN``; derive a stable index from the name."""
    prefix, slot, port = split_interface_name(name)
    numbers = interface_numbers(name)
    index = numbers[-1]
    alias = "lo" if prefix.lower().startswith("loopback") else "eth"
    return f"{alias}{index}"


def huawei_interface_name(name: str) -> str:
    """``GigabitEthernet0/1`` -> ``GE0/0/1``; ``GigabitEthernet0/1`` -> ``GE0/1``."""
    prefix, slot, port = split_interface_name(name)
    lowered = prefix.lower()
    if lowered.startswith("tengigabitethernet") or lowered.startswith("xge"):
        alias = "XGE"
    elif lowered.startswith("eth") and "trunk" not in lowered:
        alias = "Eth"
    elif lowered.startswith("loopback"):
        alias = "LoopBack"
    elif lowered.startswith("vlanif") or lowered.startswith("vlan"):
        alias = "Vlanif"
    else:
        alias = "GE"
    numbers = interface_numbers(name)
    return alias + "/".join(str(number) for number in numbers)


def aruba_interface_name(name: str) -> str:
    """AOS-CX uses ``1/1/1`` style names; keep the numeric path."""
    prefix, slot, port = split_interface_name(name)
    if prefix.lower().startswith("vlan"):
        return f"vlan{port}"
    return "/".join(str(number) for number in interface_numbers(name))


# --------------------------------------------------------------------------------------
# CIDR helpers
# --------------------------------------------------------------------------------------


def split_cidr(value: str) -> Optional[tuple[str, int]]:
    """``192.0.2.1/24`` -> ``("192.0.2.1", 24)``."""
    text = value.strip()
    if "/" not in text:
        return None
    address, _, prefix = text.partition("/")
    try:
        return address.strip(), int(prefix)
    except ValueError:
        return None


def network_from_interface(address: str, prefix: int) -> str:
    """Return the network address string for an interface, e.g. ``10.0.0.0/24``."""
    try:
        return str(ipaddress.ip_interface(f"{address}/{prefix}").network)
    except ValueError:
        return f"{address}/{prefix}"
