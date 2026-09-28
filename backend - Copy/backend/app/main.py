"""CYBERSURE conversion API.

FastAPI application exposing the configuration conversion engine to the React
frontend. Run with:

    uvicorn app.main:app --reload --port 8000
"""

from __future__ import annotations

import logging
import re
from typing import Any

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import conversion as conversion_routes
from app.api.routes import devices as device_routes
from app.api.routes import health as health_routes
from app.api.routes import reports as report_routes
from app.core.config import settings

logger = logging.getLogger("cybersure.api")


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

    @app.get("/", include_in_schema=False)
    def root() -> dict[str, Any]:
        return {
            "service": settings.app_name,
            "version": settings.version,
            "docs": "/docs",
            "api": settings.api_prefix,
        }

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

    return app


app = create_app()
