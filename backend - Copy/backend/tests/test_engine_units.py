"""Unit tests for the normalized model, addressing helpers and the IR itself."""

from __future__ import annotations

import pytest

from app.converters import available_platforms, get_converter
from app.models.device import PlatformId
from app.utils import addressing
from tests.conftest import SAMPLES


# ---------------------------------------------------------------------------------
# Addressing
# ---------------------------------------------------------------------------------


@pytest.mark.parametrize(
    "mask,prefix",
    [
        ("255.255.255.255", 32),
        ("255.255.255.0", 24),
        ("255.255.255.252", 30),
        ("255.255.0.0", 16),
        ("255.128.0.0", 9),
        ("0.0.0.0", 0),
    ],
)
def test_mask_prefix_round_trip(mask: str, prefix: int) -> None:
    assert addressing.mask_to_prefix(mask) == prefix
    assert addressing.prefix_to_mask(prefix) == mask


def test_invalid_mask_falls_back_safely() -> None:
    assert addressing.mask_to_prefix("not-a-mask") == 24
    assert addressing.prefix_to_mask(99) == "255.255.255.255"
    assert addressing.prefix_to_mask(-5) == "0.0.0.0"


def test_interface_name_translation() -> None:
    assert addressing.to_junos_interface("GigabitEthernet0/1") == "ge-0/0/1"
    assert addressing.to_junos_interface("GigabitEthernet0/0/1") == "ge-0/0/1"
    assert addressing.to_junos_interface("FastEthernet0/2") == "fe-0/0/2"
    assert addressing.to_junos_interface("TenGigabitEthernet1/1/1") == "xe-1/1/1"
    assert addressing.to_junos_interface("Loopback0") == "lo-0/0/0"
    assert addressing.to_cisco_interface("ge-0/0/1") == "GigabitEthernet0/0/1"
    assert addressing.to_cisco_interface("fe-0/0/2") == "FastEthernet0/0/2"
    # Vendor names pass through untouched.
    assert addressing.to_cisco_interface("GigabitEthernet0/1") == "GigabitEthernet0/1"


def test_platform_specific_port_naming() -> None:
    assert addressing.fortios_port_name("GigabitEthernet0/1") == "port1"
    assert addressing.fortios_port_name("GigabitEthernet1/0/1") == "port11"
    assert addressing.huawei_interface_name("GigabitEthernet0/1") == "GE0/1"
    assert addressing.aruba_interface_name("GigabitEthernet1/0/2") == "1/0/2"
    assert addressing.vyos_interface_name("GigabitEthernet0/1") == "eth1"
    assert addressing.to_generic_interface("GigabitEthernet0/1") == "ethernet0/1"


def test_split_cidr() -> None:
    assert addressing.split_cidr("10.0.0.1/24") == ("10.0.0.1", 24)
    assert addressing.split_cidr("10.0.0.1") is None
    assert addressing.split_cidr("10.0.0.1/xx") is None


# ---------------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------------


def test_all_twelve_platforms_are_registered() -> None:
    ids = {platform.value for platform in available_platforms()}
    assert ids == set(SAMPLES)


def test_every_converter_round_trips_its_own_sample() -> None:
    """Parse a platform's syntax back into a model with real content."""
    for platform in available_platforms():
        model = get_converter(platform).parse(SAMPLES[platform.value]).config
        assert not model.is_empty(), platform.value
        assert model.hostname, platform.value
        assert model.interfaces, platform.value


def test_converters_never_crash_on_empty_input() -> None:
    for platform in available_platforms():
        converter = get_converter(platform)
        result = converter.parse("")
        assert result.config.is_empty()
        # Rendering an empty model must not raise.
        rendered = converter.render(result.config)
        assert isinstance(rendered.config, str)


def test_converters_never_crash_on_garbage() -> None:
    garbage = "\x00\x01 random { } [ ] \" ' \\ nonsense @@@ ###\n" * 5
    for platform in available_platforms():
        converter = get_converter(platform)
        model = converter.parse(garbage).config
        converter.render(model)


def test_capabilities_are_declared_per_platform() -> None:
    for platform in available_platforms():
        capabilities = get_converter(platform).capabilities()
        assert "interfaces" in capabilities
        assert capabilities == list(dict.fromkeys(capabilities))


# ---------------------------------------------------------------------------------
# IR invariants
# ---------------------------------------------------------------------------------


def test_parsers_preserve_unrecognised_lines() -> None:
    for platform in available_platforms():
        model = get_converter(platform).parse(
            SAMPLES[platform.value] + "\nthis-is-not-valid-syntax-xyz\n"
        ).config
        raws = [entry.raw for entry in model.unparsed]
        assert "this-is-not-valid-syntax-xyz" in raws, platform.value


def test_mask_becomes_prefix_and_back() -> None:
    model = get_converter(PlatformId.CISCO_IOS).parse(
        "interface GigabitEthernet0/1\n ip address 10.1.2.3 255.255.240.0\n"
    ).config
    interface = model.interface("GigabitEthernet0/1")
    assert interface is not None
    assert interface.addresses[0].prefix == 20
    rendered = get_converter(PlatformId.JUNIPER_JUNOS).render(model)
    assert "10.1.2.3/20" in rendered.config


def test_interface_lookup_is_case_insensitive() -> None:
    model = get_converter(PlatformId.CISCO_IOS).parse(
        "interface GigabitEthernet0/1\n description x\n"
    ).config
    assert model.interface("gigabitethernet0/1") is not None
    assert model.interface("nope") is None


def test_duplicate_addresses_are_collapsed_for_junos() -> None:
    model = get_converter(PlatformId.JUNIPER_JUNOS).parse(
        "set interfaces ge-0/0/1 unit 0 family inet address 10.0.0.1/24\n"
        "set interfaces ge-0/0/1 unit 0 family inet address 10.0.0.1/24\n"
    ).config
    interface = model.interface("ge-0/0/1")
    assert len(interface.addresses) == 1
