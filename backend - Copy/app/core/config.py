"""Application settings, read from the environment."""

from __future__ import annotations

import os
import re
from dataclasses import dataclass, field

#: Origins that are safe to trust from any port on this machine.
#:
#: A dev server picks its own port: if 5173 is busy, Vite moves to 5174, 5175…
#: A hard-coded port list then rejects the app's own origin, and the browser
#: blocks the response — which looks exactly like a dead backend. Loopback
#: origins can only ever be this machine, so matching them by pattern is not
#: the same risk as a wildcard: no remote site can spoof `localhost`.
LOOPBACK_ORIGIN_REGEX = r"^https?://(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$"


def _split_origins(raw: str) -> list[str]:
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


def _clean_regex(raw: str) -> str:
    """Drop the env var when it is blank so the default loopback rule applies."""
    return raw.strip() or LOOPBACK_ORIGIN_REGEX


@dataclass
class Settings:
    """Runtime configuration.

    CORS trusts two things: an explicit list of exact origins, and - by default -
    any port on loopback. The wildcard is never enabled implicitly.
    """

    app_name: str = "CYBERSURE Conversion API"
    version: str = "1.0.0"
    api_prefix: str = "/api/v1"

    #: Exact origins trusted for cross-origin API calls. Comma-separated,
    #: parsed by `_split_origins`. Defaults cover:
    #:
    #:   - local dev: Vite on 5173/5174 (and 4173 preview) on localhost/127.0.0.1
    #:   - production: the deployed frontend on Vercel
    #:
    #: A production deployment should still set this explicitly, e.g.
    #: `CYBERSURE_CORS_ORIGINS=https://cybersure.vercel.app`, so the allowed
    #: list follows the environment. The loopback pattern above covers any
    #: local port; never a wildcard for remote origins.
    cors_origins: list[str] = field(
        default_factory=lambda: _split_origins(
            os.getenv(
                "CYBERSURE_CORS_ORIGINS",
                "http://localhost:5173,http://127.0.0.1:5173,"
                "http://localhost:5174,http://127.0.0.1:5174,"
                "http://localhost:4173,http://127.0.0.1:4173,"
                "https://cybersure.vercel.app",
            )
        )
    )
    allow_credentials: bool = os.getenv("CYBERSURE_CORS_CREDENTIALS", "true").lower() == "true"
    allow_origin_regex: str = field(
        default_factory=lambda: _clean_regex(
            os.getenv("CYBERSURE_CORS_ORIGIN_REGEX", "")
        )
    )

    #: Maximum accepted upload size in bytes (4 MB is plenty for a text config).
    max_upload_bytes: int = int(os.getenv("CYBERSURE_MAX_UPLOAD_BYTES", str(4 * 1024 * 1024)))
    #: Extensions we accept for configuration uploads.
    allowed_upload_extensions: set[str] = field(
        default_factory=lambda: {
            ext.strip().lower()
            for ext in os.getenv(
                "CYBERSURE_ALLOWED_UPLOAD_EXTENSIONS",
                ".cfg,.conf,.txt,.rsc,.ios,.junos,.config,.rcf",
            ).split(",")
            if ext.strip()
        }
    )

    #: In-memory report retention.
    max_reports: int = int(os.getenv("CYBERSURE_MAX_REPORTS", "100"))


settings = Settings()

#: Sanity check: the loopback rule must actually compile, or a typo here would
#: silently disable origin matching and break the frontend in a confusing way.
if not re.compile(settings.allow_origin_regex):
    raise RuntimeError(
        f"CYBERSURE_CORS_ORIGIN_REGEX is not a valid pattern: {settings.allow_origin_regex!r}"
    )
