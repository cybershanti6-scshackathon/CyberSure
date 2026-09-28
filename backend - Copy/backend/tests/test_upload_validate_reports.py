"""File upload, validation and report endpoint tests."""

from __future__ import annotations

import io

from fastapi.testclient import TestClient

from app.main import app
from tests.conftest import CISCO_IOS_SAMPLE, CISCO_NXOS_SAMPLE, JUNOS_SAMPLE

client = TestClient(app)


# ---------------------------------------------------------------------------------
# Upload
# ---------------------------------------------------------------------------------


def test_upload_converts_a_text_file() -> None:
    response = client.post(
        "/api/v1/conversions/upload",
        files={"file": ("router.cfg", CISCO_NXOS_SAMPLE.encode("utf-8"), "text/plain")},
        data={"source_platform": "cisco-nxos", "target_platform": "juniper-junos"},
    )
    assert response.status_code == 200, response.text
    result = response.json()
    assert "set system host-name Core-Switch-01" in result["converted_configuration"]


def test_upload_accepts_conf_and_txt_extensions() -> None:
    for filename in ("config.conf", "notes.txt", "export.rsc"):
        response = client.post(
            "/api/v1/conversions/upload",
            files={"file": (filename, JUNOS_SAMPLE.encode("utf-8"), "text/plain")},
            data={
                "source_platform": "juniper-junos",
                "target_platform": "cisco-iosxe",
            },
        )
        assert response.status_code == 200, filename


def test_upload_rejects_unsupported_extension() -> None:
    response = client.post(
        "/api/v1/conversions/upload",
        files={"file": ("payload.exe", b"hostname x", "application/octet-stream")},
        data={"source_platform": "cisco-ios", "target_platform": "juniper-junos"},
    )
    assert response.status_code == 415
    assert "Unsupported file type" in response.json()["detail"]


def test_upload_rejects_empty_file() -> None:
    response = client.post(
        "/api/v1/conversions/upload",
        files={"file": ("empty.cfg", b"", "text/plain")},
        data={"source_platform": "cisco-ios", "target_platform": "juniper-junos"},
    )
    assert response.status_code == 400


def test_upload_rejects_oversized_file() -> None:
    oversized = b"hostname x\n" + b"!" * (4 * 1024 * 1024 + 10)
    response = client.post(
        "/api/v1/conversions/upload",
        files={"file": ("big.cfg", oversized, "text/plain")},
        data={"source_platform": "cisco-ios", "target_platform": "juniper-junos"},
    )
    assert response.status_code == 413
    assert "upload limit" in response.json()["detail"]


def test_upload_does_not_execute_content() -> None:
    """Configuration text is data. It must never be evaluated."""
    hostile = (
        "hostname x\n"
        "__import__('os').system('echo pwned')\n"
        "${IFS}cat /etc/passwd\n"
        "`id`\n"
    )
    response = client.post(
        "/api/v1/conversions/upload",
        files={"file": ("hostile.cfg", hostile.encode("utf-8"), "text/plain")},
        data={"source_platform": "cisco-ios", "target_platform": "juniper-junos"},
    )
    assert response.status_code == 200
    body = response.text
    assert "pwned" not in body or "__import__" in body
    # The hostile lines are reported as unparsed, not executed.
    result = response.json()
    unparsed = [w.get("source_command") or "" for w in result["warnings"]]
    assert any("__import__" in item for item in unparsed)


def test_upload_with_unknown_platform_is_rejected() -> None:
    response = client.post(
        "/api/v1/conversions/upload",
        files={"file": ("a.cfg", CISCO_IOS_SAMPLE.encode(), "text/plain")},
        data={"source_platform": "cisco-ios", "target_platform": "banana"},
    )
    assert response.status_code == 422


# ---------------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------------


def test_validate_accepts_a_good_configuration() -> None:
    response = client.post(
        "/api/v1/validate",
        json={"platform": "cisco-nxos", "configuration": CISCO_NXOS_SAMPLE},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["platform"] == "cisco-nxos"
    assert body["valid"] is True
    assert body["stages"][0]["id"] == "parse"
    assert "2 interfaces" in body["stages"][0]["detail"]


def test_validate_reports_unparsed_count() -> None:
    config = CISCO_NXOS_SAMPLE + "\ncrypto key generate rsa general-keys\n"
    response = client.post(
        "/api/v1/validate", json={"platform": "cisco-nxos", "configuration": config}
    )
    body = response.json()
    assert body["unparsed_count"] >= 1


def test_validate_fails_for_unrecognisable_text() -> None:
    response = client.post(
        "/api/v1/validate",
        json={"platform": "cisco-ios", "configuration": "lorem ipsum dolor"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["valid"] is False
    assert body["status"] == "invalid"
    assert body["stages"][0]["status"] == "fail"


def test_validate_rejects_unknown_platform() -> None:
    response = client.post(
        "/api/v1/validate", json={"platform": "nope", "configuration": "hostname x"}
    )
    assert response.status_code == 422


def test_validate_rejects_empty_configuration() -> None:
    response = client.post(
        "/api/v1/validate", json={"platform": "cisco-ios", "configuration": ""}
    )
    assert response.status_code == 400


# ---------------------------------------------------------------------------------
# Reports
# ---------------------------------------------------------------------------------


def test_report_is_json_only_and_complete() -> None:
    created = client.post(
        "/api/v1/conversions",
        json={
            "source_platform": "cisco-nxos",
            "target_platform": "juniper-junos",
            "configuration": CISCO_NXOS_SAMPLE,
        },
    ).json()
    report = client.get(f"/api/v1/reports/{created['id']}").json()

    for key in (
        "report_id",
        "generated_at",
        "source_platform",
        "target_platform",
        "status",
        "summary",
        "converted_configuration",
        "warnings",
        "unsupported_commands",
        "requires_review",
        "validation",
    ):
        assert key in report, key

    assert report["source_platform"] == "cisco-nxos"
    assert report["target_platform"] == "juniper-junos"
    assert report["summary"]["commands_converted"] > 0
    assert report["summary"]["warning_count"] == len(report["warnings"])


def test_report_download_uses_the_json_filename() -> None:
    created = client.post(
        "/api/v1/conversions",
        json={
            "source_platform": "cisco-ios",
            "target_platform": "juniper-junos",
            "configuration": CISCO_IOS_SAMPLE,
        },
    ).json()
    response = client.get(f"/api/v1/reports/{created['id']}/download")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/json")
    disposition = response.headers["content-disposition"]
    assert "configuration-report.json" in disposition
    assert ".doc" not in disposition.lower()
    assert ".pdf" not in disposition.lower()


def test_report_list_and_lookup() -> None:
    created = client.post(
        "/api/v1/conversions",
        json={
            "source_platform": "cisco-ios",
            "target_platform": "juniper-junos",
            "configuration": CISCO_IOS_SAMPLE,
        },
    ).json()
    listing = client.get("/api/v1/reports").json()
    assert listing["count"] >= 1
    assert any(item["report_id"] == created["id"] for item in listing["reports"])
    assert listing["reports"][0]["filename"] == "configuration-report.json"


def test_unknown_report_is_404() -> None:
    assert client.get("/api/v1/reports/NOPE").status_code == 404
    assert client.get("/api/v1/reports/NOPE/download").status_code == 404


def test_report_can_be_created_directly() -> None:
    response = client.post(
        "/api/v1/reports/configuration",
        json={
            "source_platform": "cisco-nxos",
            "target_platform": "juniper-junos",
            "configuration": CISCO_NXOS_SAMPLE,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["report_type"] == "configuration-conversion"
    assert "set system host-name Core-Switch-01" in body["converted_configuration"]
