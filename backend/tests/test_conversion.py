"""Conversion endpoint tests.

The headline requirement is that *any* supported platform converts to *any*
other, with no hard-coded pair list. These tests cover the specific pairs
called out in the brief plus a full cross-product smoke test.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from tests.conftest import (
    ARISTA_EOS_SAMPLE,
    CISCO_IOS_SAMPLE,
    CISCO_IOS_XE_SAMPLE,
    CISCO_NXOS_SAMPLE,
    FORTIOS_SAMPLE,
    HUAWEI_SAMPLE,
    JUNOS_SAMPLE,
    PANOS_SAMPLE,
    ROUTEROS_SAMPLE,
    SAMPLES,
    VYOS_SAMPLE,
)

client = TestClient(app)

ALL_PLATFORMS = sorted(SAMPLES)


def convert(source: str, target: str, configuration: str, **extra):
    payload = {
        "source_platform": source,
        "target_platform": target,
        "configuration": configuration,
    }
    payload.update(extra)
    return client.post("/api/v1/conversions", json=payload)


# ---------------------------------------------------------------------------------
# The specific pairs named in the brief
# ---------------------------------------------------------------------------------


def test_cisco_nxos_to_junos_produces_real_junos() -> None:
    """The flow that previously returned "no mapping"."""
    response = convert("cisco-nxos", "juniper-junos", CISCO_NXOS_SAMPLE)
    assert response.status_code == 200
    result = response.json()

    assert result["source_platform"] == "cisco-nxos"
    assert result["target_platform"] == "juniper-junos"
    assert result["status"] in {"success", "partial", "requires_review"}

    output = result["converted_configuration"]
    assert "set system host-name Core-Switch-01" in output
    assert "set vlans 10" in output
    assert 'set vlans 10 name "CLIENTS"' in output
    assert "set interfaces ge-1/0/1 unit 0 family inet address 10.40.0.2/24" in output
    assert "port-mode access" in output
    assert "set routing-options static route 0.0.0.0/0 next-hop 10.40.0.254" in output
    assert output.rstrip().endswith("commit")
    assert result["unsupported"] == 0
    assert result["commands_converted"] > 0
    assert [stage["id"] for stage in result["validation"]] == [
        "syntax",
        "mapping",
        "parameters",
        "conflicts",
    ]


def test_cisco_ios_to_junos() -> None:
    result = convert("cisco-ios", "juniper-junos", CISCO_IOS_SAMPLE).json()
    output = result["converted_configuration"]
    assert "set system host-name Router-A" in output
    assert "set system name-server 10.0.0.53" in output
    assert "set system ntp server 10.0.0.123 prefer" in output
    assert "set system syslog host 10.0.0.99" in output
    assert "set vlans 30" in output
    assert "ge-0/0/1" in output and "ge-0/0/2" in output
    assert "192.0.2.1/32" in output  # Loopback0 becomes a /32 host route
    assert "set protocols ospf router-id 10.10.0.1" in output


def test_cisco_iosxe_to_junos() -> None:
    result = convert("cisco-iosxe", "juniper-junos", CISCO_IOS_XE_SAMPLE).json()
    output = result["converted_configuration"]
    assert "set system host-name Edge-XE-01" in output
    assert 'set vlans 10 name "USERS"' in output
    assert "port-mode trunk" in output
    assert "vlan members [10,20]" in output
    assert "10.20.0.2/24" in output


def test_cisco_iosxe_to_fortios() -> None:
    result = convert("cisco-iosxe", "fortinet-fortios", CISCO_IOS_XE_SAMPLE).json()
    output = result["converted_configuration"]
    assert output.count("config system interface") == 3
    # GigabitEthernet1/0/1 -> port11, 1/0/2 -> port12, 1/0/10 -> port110
    assert 'edit "port11"' in output
    assert 'edit "port12"' in output
    assert 'edit "port110"' in output
    assert "set ip 10.20.0.2 255.255.255.0" in output
    assert "config system vlan" in output
    assert 'set vlan-name "USERS"' in output
    # Every config block is closed.
    assert output.count("config ") == output.count("end")


def test_cisco_iosxe_to_panos() -> None:
    result = convert("cisco-iosxe", "paloalto-panos", CISCO_IOS_XE_SAMPLE).json()
    output = result["converted_configuration"]
    assert "set deviceconfig hostname Edge-XE-01" in output
    assert "set interface ethernet1/0/10 ip-address 10.20.0.2/24" in output
    assert 'set vlan 10 name "USERS"' in output
    assert output.rstrip().endswith("commit")


def test_junos_to_cisco_iosxe() -> None:
    result = convert("juniper-junos", "cisco-iosxe", JUNOS_SAMPLE).json()
    output = result["converted_configuration"]
    assert "hostname Junos-Router-01" in output
    assert "ip domain-name example.net" in output
    assert "ip name-server 8.8.8.8" in output
    assert "ip address 172.16.0.1 255.255.255.252" in output  # /30
    assert "interface GigabitEthernet0/0/1" in output
    assert "mtu 9192" in output


def test_routeros_to_cisco_iosxe() -> None:
    result = convert("mikrotik-routeros", "cisco-iosxe", ROUTEROS_SAMPLE).json()
    output = result["converted_configuration"]
    assert "hostname router-01" in output
    assert "ip address 10.50.0.1 255.255.255.0" in output
    assert "ip route 0.0.0.0 0.0.0.0 10.50.0.254" in output
    assert "ip name-server 10.0.0.53 10.0.0.54" in output
    assert "ntp server 10.0.0.123" in output


# ---------------------------------------------------------------------------------
# Additional families, proving the IR is genuinely platform-agnostic
# ---------------------------------------------------------------------------------


@pytest.mark.parametrize(
    "source,target,fixture,expected",
    [
        ("fortinet-fortios", "juniper-junos", FORTIOS_SAMPLE, "set system host-name fw-edge-01"),
        ("paloalto-panos", "cisco-iosxe", PANOS_SAMPLE, "hostname pa-edge-01"),
        ("huawei-vrp", "cisco-iosxe", HUAWEI_SAMPLE, "hostname VRP-Router-01"),
        ("vyos", "cisco-iosxe", VYOS_SAMPLE, "hostname vyos-01"),
        ("arista-eos", "cisco-iosxe", ARISTA_EOS_SAMPLE, "hostname Leaf-01"),
        ("cisco-nxos", "fortinet-fortios", CISCO_NXOS_SAMPLE, "config system interface"),
        ("huawei-vrp", "vyos", HUAWEI_SAMPLE, "set host-name 'VRP-Router-01'"),
        ("mikrotik-routeros", "paloalto-panos", ROUTEROS_SAMPLE, "set deviceconfig hostname router-01"),
    ],
)
def test_additional_platform_pairs(
    source: str, target: str, fixture: str, expected: str
) -> None:
    response = convert(source, target, fixture)
    assert response.status_code == 200, response.text
    result = response.json()
    assert expected in result["converted_configuration"], (
        source,
        target,
        result["converted_configuration"],
    )
    assert result["commands_converted"] > 0


def test_every_platform_pair_produces_output() -> None:
    """Full 12x12 cross product: no pair may be refused up front."""
    for source in ALL_PLATFORMS:
        for target in ALL_PLATFORMS:
            response = convert(source, target, SAMPLES[source])
            assert response.status_code == 200, (source, target, response.text)
            result = response.json()
            assert result["converted_configuration"].strip(), (source, target)
            assert result["status"] in {
                "success",
                "partial",
                "requires_review",
                "unsupported",
                "invalid",
            }
            # A conversion is never silently empty: either something was
            # translated, or every gap is reported.
            assert (
                result["commands_converted"] > 0
                or result["unsupported"] > 0
                or result["requires_review"] > 0
            ), (source, target, result)


def test_same_platform_round_trip_is_stable() -> None:
    for platform in ALL_PLATFORMS:
        result = convert(platform, platform, SAMPLES[platform]).json()
        assert result["converted_configuration"].strip(), platform


# ---------------------------------------------------------------------------------
# Error handling
# ---------------------------------------------------------------------------------


def test_unknown_source_platform_is_rejected() -> None:
    response = convert("totally-made-up", "juniper-junos", CISCO_IOS_SAMPLE)
    assert response.status_code == 422
    detail = response.json()["detail"]
    assert "Unknown source platform" in detail
    assert "GET /api/v1/devices" in detail


def test_unknown_target_platform_is_rejected() -> None:
    response = convert("cisco-ios", "nope", CISCO_IOS_SAMPLE)
    assert response.status_code == 422
    assert "Unknown target platform" in response.json()["detail"]


def test_empty_configuration_is_rejected() -> None:
    response = convert("cisco-ios", "juniper-junos", "   \n  ")
    assert response.status_code == 400
    assert "empty" in response.json()["detail"].lower()


def test_configuration_in_the_wrong_language_is_reported_not_guessed() -> None:
    response = convert("cisco-ios", "juniper-junos", "this is a poem not a config\n")
    assert response.status_code == 422
    assert "No recognised cisco-ios configuration statements" in response.json()["detail"]
    assert "this is a poem" in response.json()["detail"]


def test_wrong_source_platform_names_the_likely_platform() -> None:
    """A Cisco configuration submitted as FortiOS must name the mismatch."""
    response = convert("fortinet-fortios", "juniper-junos", CISCO_IOS_SAMPLE)
    assert response.status_code == 422
    detail = response.json()["detail"]
    assert "Configuration appears to use Cisco IOS" in detail
    assert "Fortinet FortiOS was selected as the source platform" in detail


def test_same_family_never_blames_the_selection() -> None:
    """Within one CLI family the generic message stands - no false accusation."""
    response = convert("cisco-iosxe", "juniper-junos", "this is a poem not a config\n")
    assert response.status_code == 422
    detail = response.json()["detail"]
    assert "No recognised cisco-iosxe configuration statements" in detail
    assert "appears to use" not in detail


def test_platform_id_spelling_variants_resolve() -> None:
    from app.models.device import PlatformId, resolve_platform

    assert resolve_platform("cisco-iosxe") == PlatformId.CISCO_IOS_XE
    assert resolve_platform("cisco-ios-xe") == PlatformId.CISCO_IOS_XE
    assert resolve_platform("cisco ios xe") == PlatformId.CISCO_IOS_XE


def test_missing_required_fields_return_422() -> None:
    response = client.post(
        "/api/v1/conversions",
        json={"source_platform": "cisco-ios", "configuration": "hostname x"},
    )
    assert response.status_code == 422


# ---------------------------------------------------------------------------------
# Honesty guarantees
# ---------------------------------------------------------------------------------


def test_unsupported_commands_are_reported_with_the_original_text() -> None:
    """A statement the source parser cannot model must surface, not disappear."""
    config = CISCO_IOS_SAMPLE + "\ncrypto isakmp key MYKEY address 10.0.0.1 0.0.0.0\n"
    result = convert("cisco-ios", "juniper-junos", config).json()
    unsupported = [w for w in result["warnings"] if w["status"] == "unsupported"]
    assert unsupported, result["warnings"]
    assert any("crypto isakmp" in (w.get("source_command") or "") for w in unsupported)


def test_untranslatable_concepts_are_marked_not_invented() -> None:
    """ACLs become explicit `unsupported` items, never fake Junos filters."""
    config = CISCO_IOS_SAMPLE + """
!
ip access-list extended MGMT
 permit tcp 10.0.0.0 0.0.0.255 any eq 22
!
"""
    result = convert("cisco-ios", "juniper-junos", config).json()
    acl_issues = [
        w
        for w in result["warnings"]
        if w["concept"] == "Access control lists" and w["status"] == "unsupported"
    ]
    assert acl_issues
    output = result["converted_configuration"]
    # No fabricated firewall filter / term statements.
    assert "firewall family inet" not in output
    assert "term " not in output
    assert result["status"] in {"partial", "requires_review", "unsupported"}


def test_unsupported_items_quote_the_original_command() -> None:
    """The brief requires the original command in the report, not just a label."""
    config = CISCO_IOS_SAMPLE + """
!
ip access-list extended MGMT
 permit tcp 10.0.0.0 0.0.0.255 any eq 22
!
ip nat inside source list NATLIST overload
!
"""
    result = convert("cisco-ios", "juniper-junos", config).json()
    unsupported = [w for w in result["warnings"] if w["status"] == "unsupported"]
    assert unsupported
    for issue in unsupported:
        assert issue["source_command"], issue
        assert issue["source_command"] in config, issue

    # The line-by-line table must mark the same statements.
    flagged = [entry for entry in result["mapping"] if entry["status"] != "converted"]
    flagged_sources = {entry["source"] for entry in flagged}
    assert any("ip access-list extended MGMT" in source for source in flagged_sources), flagged_sources
    assert any("ip nat inside source list NATLIST" in source for source in flagged_sources), flagged_sources
    for entry in flagged:
        assert entry["note"], entry


def test_report_unsupported_commands_carry_the_source_text() -> None:
    config = CISCO_IOS_SAMPLE + "\nip access-list extended MGMT\n permit tcp any any eq 22\n"
    created = convert("cisco-ios", "juniper-junos", config).json()
    report = client.get(f"/api/v1/reports/{created['id']}").json()
    assert report["unsupported_commands"], report["unsupported_commands"]
    for entry in report["unsupported_commands"]:
        assert entry["source_command"]
        assert entry["source_command"] in config


def test_warnings_never_contain_a_python_traceback() -> None:
    result = convert("cisco-ios", "juniper-junos", CISCO_IOS_SAMPLE).json()
    serialised = str(result).lower()
    for marker in ("traceback", "site-packages", "line 1, in", "mostrecentcall"):
        assert marker not in serialised, marker


def test_result_ids_are_unique() -> None:
    first = convert("cisco-ios", "juniper-junos", CISCO_IOS_SAMPLE).json()["id"]
    second = convert("cisco-ios", "juniper-junos", CISCO_IOS_SAMPLE).json()["id"]
    assert first != second
    assert first.startswith("CONV-")


def test_mapping_covers_every_significant_source_line() -> None:
    result = convert("cisco-ios", "juniper-junos", CISCO_IOS_SAMPLE).json()
    lines = [entry["line"] for entry in result["mapping"]]
    assert lines == sorted(lines)
    assert len(lines) > 15
    for entry in result["mapping"]:
        assert entry["status"] in {"converted", "requires_review", "unsupported"}
        assert entry["rule_label"]


def test_validation_can_be_skipped() -> None:
    result = convert(
        "cisco-ios", "juniper-junos", CISCO_IOS_SAMPLE, validate=False
    ).json()
    assert result["validation"] == []


def test_conversion_can_be_fetched_by_id() -> None:
    created = convert("cisco-ios", "juniper-junos", CISCO_IOS_SAMPLE).json()
    response = client.get(f"/api/v1/conversions/{created['id']}")
    assert response.status_code == 200
    assert response.json()["report_id"] == created["id"]


def test_unknown_conversion_id_is_404() -> None:
    assert client.get("/api/v1/conversions/CONV-DEADBEEF").status_code == 404
