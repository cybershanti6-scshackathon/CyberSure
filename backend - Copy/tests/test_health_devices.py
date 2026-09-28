"""Health, device catalogue and detection endpoint tests."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app
from tests.conftest import SAMPLES

client = TestClient(app)


def test_health_reports_engine_and_platforms() -> None:
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["engine"] == "normalized-ir"
    assert body["platforms_supported"] == 12
    assert "juniper-junos" in body["platform_ids"]


def test_health_ready_has_no_failures() -> None:
    response = client.get("/api/v1/health/ready")
    assert response.status_code == 200
    body = response.json()
    assert body["ready"] is True
    assert body["failures"] == {}


def test_devices_lists_every_required_platform() -> None:
    response = client.get("/api/v1/devices")
    assert response.status_code == 200
    body = response.json()
    assert body["count"] == 12
    ids = {item["id"] for item in body["platforms"]}
    assert ids == set(SAMPLES)
    for item in body["platforms"]:
        assert item["name"]
        assert item["vendor"]
        assert item["capabilities"]


def test_device_detail_for_known_platform() -> None:
    response = client.get("/api/v1/devices/cisco-nxos")
    assert response.status_code == 200
    assert response.json()["name"] == "Cisco NX-OS"


def test_device_detail_for_unknown_platform_is_404() -> None:
    response = client.get("/api/v1/devices/not-a-platform")
    assert response.status_code == 404
    assert "Unknown platform" in response.json()["detail"]


def test_detection_identifies_each_sample() -> None:
    expected = {
        "cisco-ios": "cisco-ios",
        "cisco-nxos": "cisco-nxos",
        "juniper-junos": "juniper-junos",
        "fortinet-fortios": "fortinet-fortios",
        "paloalto-panos": "paloalto-panos",
        "mikrotik-routeros": "mikrotik-routeros",
        "huawei-vrp": "huawei-vrp",
        "vyos": "vyos",
    }
    for platform, want in expected.items():
        response = client.post(
            "/api/v1/detect", json={"configuration": SAMPLES[platform]}
        )
        assert response.status_code == 200, platform
        body = response.json()
        assert body["platform"] == want, (platform, body)
        assert body["confidence"] > 0.3
        assert body["reasons"], platform


def test_detection_is_not_certain_on_unrecognisable_text() -> None:
    response = client.post(
        "/api/v1/detect", json={"configuration": "the quick brown fox jumps over it"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["platform"] is None
    assert body["confidence"] < 0.35
    assert "No recognisable configuration syntax" in body["reasons"][0]


def test_detection_honours_an_explicit_hint() -> None:
    response = client.post(
        "/api/v1/detect",
        json={"configuration": "hostname x", "platform": "cisco-iosxe"},
    )
    body = response.json()
    assert body["platform"] == "cisco-iosxe"
    assert body["confidence"] == 1.0


def test_detection_rejects_empty_configuration() -> None:
    response = client.post("/api/v1/detect", json={"configuration": "   "})
    assert response.status_code == 400


# ---------------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------------

PREFLIGHT = {
    "origin": "http://localhost:5173",
    "access-control-request-method": "POST",
    "access-control-request-headers": "content-type",
}


def _preflight(origin: str):
    return client.options(
        "/api/v1/conversions",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )


def test_cors_allows_the_vite_dev_origin() -> None:
    response = _preflight("http://localhost:5173")
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert "content-type" in response.headers["access-control-allow-headers"].lower()
    assert "POST" in response.headers["access-control-allow-methods"]


def test_cors_allows_a_shifted_dev_server_port() -> None:
    """Vite moves to 5174/5175 when 5173 is busy; the app must still work.

    A hard-coded port list makes this look like a dead backend, because the
    browser blocks the response and reports an opaque network error.
    """
    for port in (5173, 5174, 5175, 5187, 3000):
        response = _preflight(f"http://localhost:{port}")
        assert response.status_code == 200, port
        assert response.headers["access-control-allow-origin"] == f"http://localhost:{port}"


def test_cors_allows_loopback_aliases() -> None:
    for origin in ("http://127.0.0.1:5199", "http://[::1]:5199", "https://localhost:5173"):
        response = _preflight(origin)
        assert response.status_code == 200, origin
        assert response.headers["access-control-allow-origin"] == origin


def test_cors_refuses_remote_and_lookalike_origins() -> None:
    """The loopback pattern must be anchored, not a wildcard."""
    for origin in (
        "https://evil.example",
        "http://localhost.evil.example",
        "http://notlocalhost:5173",
        "http://127.0.0.1.evil.example:5173",
        "null",
    ):
        response = _preflight(origin)
        assert "access-control-allow-origin" not in response.headers, origin


def test_cors_never_answers_with_a_wildcard_and_credentials() -> None:
    """`*` plus credentials is rejected by browsers, so it must never be sent."""
    for port in (5173, 5175):
        response = _preflight(f"http://localhost:{port}")
        assert response.headers["access-control-allow-origin"] != "*"
        assert response.headers["access-control-allow-origin"] == f"http://localhost:{port}"


def test_health_is_a_cors_simple_get() -> None:
    """The availability probe must work without a preflight."""
    response = client.get("/api/v1/health", headers={"Origin": "http://localhost:5175"})
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5175"


def test_unversioned_health_alias_answers() -> None:
    """Monitors conventionally probe `/health`; a 404 storm reads as a broken API.

    The canonical endpoint is `/api/v1/health`, but a load balancer or container
    probe hitting `/health` must get a 200 rather than a misleading 404.
    """
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["api"] == "/api/v1"


def test_health_alias_matches_the_versioned_endpoint() -> None:
    alias = client.get("/health").json()
    canonical = client.get("/api/v1/health").json()
    for key in ("status", "service", "version"):
        assert alias[key] == canonical[key], key
