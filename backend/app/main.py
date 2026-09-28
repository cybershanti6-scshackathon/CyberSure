"""CYBERSURE conversion API.

FastAPI application exposing the configuration conversion engine to the React
frontend. In production the compiled React app (dist/) is served from this
same process — one URL, no CORS, no separate static-site service.

Run locally (API only, Vite handles the frontend separately):
    uvicorn app.main:app --reload --port 8000

The frontend is served automatically when the dist/ directory exists next to
the repo root (i.e. after `npm run build`).
"""

from __future__ import annotations

import logging
import re
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api.routes import conversion as conversion_routes
from app.api.routes import devices as device_routes
from app.api.routes import health as health_routes
from app.api.routes import reports as report_routes
from app.core.config import settings

logger = logging.getLogger("cybersure.api")

# dist/ lives at the repository root — two levels above this file
# (backend/app/main.py → backend/app → backend → repo-root/dist)
_REPO_ROOT = Path(__file__).parent.parent.parent
_DIST_DIR = _REPO_ROOT / "dist"


def _configure_logging() -> None:
    """Make the app logger visible.

    Uvicorn configures its own loggers, so an application logger with no handler
    of its own emits nothing. The startup lines below are the first thing to
    check when a browser cannot reach the API, so they must actually appear.
    """
    if logger.handlers:
        return
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(levelname)s: %(message)s"))
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    logger.propagate = False

_DESCRIPTION = """
Backend for the CYBERSURE configuration converter.

Every conversion runs through the same pipeline:

    source text -> platform parser -> normalized network model
                -> target renderer -> validation -> JSON report

Because the intermediate model is shared, *any* supported platform can be
converted to *any* other. Constructs that cannot be translated faithfully are
reported as `unsupported` or `requires_review` rather than guessed at.
"""


def _install_cors(app: FastAPI) -> None:
    """Allow the frontend origin, whatever dev-server port it landed on.

    `allow_origin_regex` trusts loopback origins on any port, so a Vite server
    that had to move off 5173 is still accepted. A wildcard is never used.

    In merged (single-service) production deployments the browser never sends
    an Origin header for same-origin requests, so CORS middleware is a no-op —
    it still runs but never blocks anything.
    """
    kwargs: dict[str, Any] = {
        "allow_origins": settings.cors_origins,
        "allow_credentials": settings.allow_credentials,
        "allow_methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Accept", "Authorization", "X-Requested-With"],
        "max_age": 600,
    }
    if settings.allow_origin_regex:
        kwargs["allow_origin_regex"] = settings.allow_origin_regex
    app.add_middleware(CORSMiddleware, **kwargs)
    logger.info("CORS exact origins: %s", ", ".join(settings.cors_origins) or "(none)")
    if settings.allow_origin_regex:
        logger.info("CORS origin pattern: %s", settings.allow_origin_regex)


def _mount_frontend(app: FastAPI) -> None:
    """Serve the compiled React SPA from dist/ if it exists.

    API routes registered before this mount take priority, so /api/v1/...
    is never intercepted by the static-file handler.

    The SPA catch-all (/*) returns index.html so that client-side routes
    like /converter and /dashboard work on a hard refresh or direct link.
    """
    if not _DIST_DIR.is_dir():
        logger.info(
            "dist/ not found at %s — frontend not served by this process "
            "(normal for local API-only development).",
            _DIST_DIR,
        )
        return

    logger.info("Serving React frontend from %s", _DIST_DIR)

    # Mount Vite's assets directory directly so hashed filenames get long
    # cache-control headers without walking the whole dist tree.
    assets_dir = _DIST_DIR / "assets"
    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    # Catch-all: any path that did not match an API route or /assets returns
    # index.html so React Router handles client-side navigation.
    index_html = _DIST_DIR / "index.html"

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str) -> FileResponse:  # noqa: ARG001
        # Serve a real file if it exists (favicon.ico, robots.txt, etc.),
        # otherwise hand control to React Router via index.html.
        requested = _DIST_DIR / full_path
        if requested.is_file():
            return FileResponse(requested)
        return FileResponse(index_html)


def create_app() -> FastAPI:
    _configure_logging()
    app = FastAPI(
        title=settings.app_name,
        version=settings.version,
        description=_DESCRIPTION,
        docs_url="/docs",
        redoc_url=None,
    )
    _install_cors(app)

    app.include_router(health_routes.router, prefix=settings.api_prefix)
    app.include_router(device_routes.router, prefix=settings.api_prefix)
    app.include_router(conversion_routes.router, prefix=settings.api_prefix)
    app.include_router(report_routes.router, prefix=settings.api_prefix)

    @app.get("/health", include_in_schema=False)
    def root_health() -> dict[str, Any]:
        """Unversioned health alias.

        Load balancers, container orchestrators and local monitors conventionally
        probe `/health`. Without this they get a 404 on every check, which fills
        the access log with entries that look like a misbehaving API. The
        canonical endpoint is still `/api/v1/health`.
        """
        return {
            "status": "ok",
            "service": settings.app_name,
            "version": settings.version,
            "api": settings.api_prefix,
        }

    @app.exception_handler(ValueError)
    async def value_error_handler(request: Request, exc: ValueError) -> JSONResponse:
        return JSONResponse(status_code=400, content={"detail": str(exc)})

    @app.exception_handler(Exception)
    async def unhandled_handler(request: Request, exc: Exception) -> JSONResponse:
        # Never leak a stack trace to the client; log it server-side instead.
        logger.exception("Unhandled error on %s", request.url.path, exc_info=exc)
        return JSONResponse(
            status_code=500,
            content={
                "detail": "The conversion engine encountered an internal error.",
                "type": type(exc).__name__,
            },
        )

    # Mount the frontend LAST so API routes always take priority.
    _mount_frontend(app)

    return app


app = create_app()
