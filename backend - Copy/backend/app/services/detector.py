"""Platform detection.

Detection returns a platform, a confidence and the reasons behind it. It never
claims certainty: when no fingerprint matches clearly the confidence stays low
and ``platform`` may be ``None`` so the caller has to choose.
"""

from __future__ import annotations

import re
from typing import Optional

from app.models.device import PlatformId, resolve_platform

#: (platform, weight, fingerprint regex, human-readable reason)
FINGERPRINTS: list[tuple[PlatformId, int, re.Pattern[str], str]] = [
    (PlatformId.FORTINET_FORTIOS, 40, re.compile(r"^\s*config\s+system\s+global", re.M), "FortiOS `config system global` block"),
    (PlatformId.FORTINET_FORTIOS, 25, re.compile(r"^\s*edit\s+\"port\d+\"", re.M), "FortiOS `edit \"portN\"` object"),
    (PlatformId.FORTINET_FORTIOS, 20, re.compile(r"^\s*next\s*$", re.M), "FortiOS `next` terminator"),

    (PlatformId.MIKROTIK_ROUTEROS, 45, re.compile(r"^\s*/[a-z-]+(/[a-z-]+)*\s*$", re.M), "RouterOS path block"),
    (PlatformId.MIKROTIK_ROUTEROS, 20, re.compile(r"^\s*(add|set)\s+[\w-]+=", re.M), "RouterOS key=value assignment"),

    (PlatformId.JUNIPER_JUNOS, 35, re.compile(r"^\s*set\s+system\s+host-name\b", re.M), "Junos `set system host-name`"),
    (PlatformId.JUNIPER_JUNOS, 20, re.compile(r"^\s*set\s+interfaces\s+\S+\s+unit\s", re.M), "Junos interface unit statement"),
    (PlatformId.JUNIPER_JUNOS, 12, re.compile(r"^\s*set\s+system\s+services\s+ssh\b", re.M), "Junos system services ssh"),

    (PlatformId.PALOALTO_PANOS, 40, re.compile(r"^\s*set\s+deviceconfig\s+hostname\b", re.M), "PAN-OS deviceconfig hostname"),
    (PlatformId.PALOALTO_PANOS, 25, re.compile(r"^\s*set\s+interface\s+ethernet\d+/\d+\b", re.M), "PAN-OS ethernet interface"),
    (PlatformId.PALOALTO_PANOS, 15, re.compile(r"^\s*set\s+deviceconfig\s+(ssh|domain-name)\b", re.M), "PAN-OS deviceconfig management"),

    (PlatformId.HUAWEI_VRP, 40, re.compile(r"^\s*sysname\s+\S+", re.M), "VRP `sysname` statement"),
    (PlatformId.HUAWEI_VRP, 25, re.compile(r"^\s*interface\s+(GigabitEthernet|GE|XGE|Eth-Trunk)\S*", re.M), "VRP interface naming"),
    (PlatformId.HUAWEI_VRP, 20, re.compile(r"^\s*ip\s+route-static\b", re.M), "VRP `ip route-static`"),
    (PlatformId.HUAWEI_VRP, 10, re.compile(r"^\s*stelnet\s+server\s+enable", re.M), "VRP stelnet service"),

    (PlatformId.VYOS, 40, re.compile(r"^\s*set\s+host-name\b", re.M), "VyOS `set host-name`"),
    (PlatformId.VYOS, 20, re.compile(r"^\s*set\s+interfaces\s+ethernet\b", re.M), "VyOS ethernet interface"),
    (PlatformId.VYOS, 10, re.compile(r"^\s*set\s+system\s+ntp\s+server\b", re.M), "VyOS system ntp"),

    (PlatformId.ARISTA_EOS, 30, re.compile(r"^\s*(?:transceiver|daemon|hardware)\b", re.M), "Arista EOS system statement"),
    (PlatformId.ARISTA_EOS, 20, re.compile(r"^\s*interface\s+Et\d+", re.M), "EOS `Et<n>` interface naming"),

    (PlatformId.ARUBA_AOSCX, 25, re.compile(r"^\s*interface\s+\d+/\d+/\d+\s*$", re.M), "AOS-CX `1/1/1` interface naming"),

    (PlatformId.CISCO_NXOS, 30, re.compile(r"^\s*feature\s+(?:nxos|interface-vlan|ospf|bgp|bfd|vpc)\b", re.M), "NX-OS `feature` statement"),
    (PlatformId.CISCO_NXOS, 20, re.compile(r"^\s*vlan\s+\d+\s*\n\s*name\s+", re.M), "NX-OS VLAN name sub-line"),

    (PlatformId.CISCO_ASA, 35, re.compile(r"^\s*nat\s+\(\s*\w+\s*,\s*\w+\s*\)", re.M), "ASA `nat (real,global)` statement"),
    (PlatformId.CISCO_ASA, 25, re.compile(r"^\s*security-level\s+\d+", re.M), "ASA security-level"),
    (PlatformId.CISCO_ASA, 15, re.compile(r"^\s*access-list\s+\S+\s+extended\b", re.M), "ASA named extended access-list"),

    (PlatformId.CISCO_IOS, 10, re.compile(r"^\s*version\s+\d+", re.M), "IOS version header"),
    (PlatformId.CISCO_IOS_XE, 10, re.compile(r"^\s*service\s+internal|^\s*license\s+", re.M), "IOS XE system statement"),

    (PlatformId.CISCO_IOS, 10, re.compile(r"^\s*ip\s+ssh\s+version\s+2", re.M), "Cisco `ip ssh version 2`"),
    (PlatformId.CISCO_IOS_XE, 10, re.compile(r"^\s*ip\s+ssh\s+version\s+2", re.M), "Cisco `ip ssh version 2`"),
    (PlatformId.CISCO_NXOS, 10, re.compile(r"^\s*ip\s+ssh\s+version\s+2", re.M), "Cisco `ip ssh version 2`"),
]

#: Shared Cisco fallback fingerprints, used when nothing else matched strongly.
CISCO_FALLBACK = [
    (25, re.compile(r"^\s*hostname\s+\S+", re.M), "Cisco `hostname` statement"),
    (25, re.compile(r"^\s*interface\s+\S+", re.M), "Cisco `interface` block"),
    (20, re.compile(r"^\s*ip\s+address\s+\d+\.\d+\.\d+\.\d+", re.M), "Cisco `ip address`"),
    (15, re.compile(r"^\s*ip\s+route\s+\d+\.\d+\.\d+\.\d+", re.M), "Cisco `ip route` statement"),
    (10, re.compile(r"^\s*!\s*$", re.M), "Cisco `!` separators"),
]

#: Platforms that share the Cisco-style CLI and therefore all pick up the
#: generic Cisco evidence. Individually they stay close together, which is why
#: the confidence margin - not a hard winner - is what the caller sees.
CISCO_LIKE_PLATFORMS = (
    PlatformId.CISCO_IOS,
    PlatformId.CISCO_IOS_XE,
    PlatformId.CISCO_NXOS,
    PlatformId.ARISTA_EOS,
    PlatformId.ARUBA_AOSCX,
)


def detect_platform(text: str, hint: Optional[str] = None) -> dict:
    """Return ``{platform, confidence, reasons, candidates}``.

    ``platform`` is ``None`` when nothing matched with useful confidence, so the
    caller is forced to pick rather than being given a wrong guess.
    """
    if hint:
        resolved = resolve_platform(hint)
        if resolved is not None:
            return {
                "platform": resolved.value,
                "confidence": 1.0,
                "reasons": [f"Platform supplied by the caller ({hint})"],
                "candidates": [],
            }

    scores: dict[PlatformId, int] = {}
    reasons: dict[PlatformId, list[str]] = {}

    def award(platform: PlatformId, weight: int, reason: str) -> None:
        scores[platform] = scores.get(platform, 0) + weight
        reasons.setdefault(platform, []).append(reason)

    for platform, weight, pattern, reason in FINGERPRINTS:
        if pattern.search(text):
            award(platform, weight, reason)

    # Every Cisco-style CLI shares the same base syntax, so the generic
    # evidence is granted to all of them and disambiguated by the
    # platform-specific fingerprints above.
    for weight, pattern, reason in CISCO_FALLBACK:
        if pattern.search(text):
            for platform in CISCO_LIKE_PLATFORMS:
                award(platform, weight, reason)

    candidates = [
        {"platform": platform.value, "score": score, "reasons": reasons[platform]}
        for platform, score in sorted(
            scores.items(), key=lambda item: (-item[1], item[0].value)
        )
    ]

    if not candidates:
        return {
            "platform": None,
            "confidence": 0.0,
            "reasons": ["No recognisable configuration syntax was found."],
            "candidates": [],
        }

    best = candidates[0]
    runner_up = candidates[1]["score"] if len(candidates) > 1 else 0
    # Confidence blends absolute evidence with the margin over the runner-up.
    absolute = min(0.9, best["score"] / 100.0)
    margin = 0.0 if best["score"] == 0 else (best["score"] - runner_up) / best["score"]
    confidence = round(min(0.97, 0.55 * absolute + 0.45 * margin), 3)

    if confidence < 0.35:
        return {
            "platform": None,
            "confidence": confidence,
            "reasons": ["Several platforms match; choose the source platform explicitly."],
            "candidates": candidates[:4],
        }

    return {
        "platform": best["platform"],
        "confidence": confidence,
        "reasons": best["reasons"],
        "candidates": candidates[1:4],
    }
