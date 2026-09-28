"""Vercel Function entrypoint for the CYBERSURE conversion API.

Wiring (all of it lives in this repo, nothing is configured in a dashboard):

    browser  ->  https://cybersure.vercel.app/api/v1/...
                     |
                     |  vercel.json rewrite: /api/(.*) -> /api/index.py
                     v
               this file  ->  FastAPI app from backend/app/main.py

Vercel forwards the ORIGINAL request path, so `app.main` sees exactly the URLs
it sees locally (/api/v1/health, /api/v1/conversions, ...).

The backend package lives in `backend/`, which is not importable from the
project root. The app's own imports are package-relative (`app.api.routes...`),
so `backend/` - not `backend/app` - must go on `sys.path`, and that has to
happen before the first `app.*` import.
"""

from __future__ import annotations

import sys
from pathlib import Path

_BACKEND_ROOT = Path(__file__).resolve().parent.parent / "backend"
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from app.main import app  # noqa: E402  (sys.path must be fixed first)

__all__ = ["app"]
