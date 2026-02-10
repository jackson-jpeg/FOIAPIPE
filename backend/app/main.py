"""FastAPI application entry point for FOIAPIPE.

FOIAPIPE is a FOIA (Freedom of Information Act) request pipeline and video publishing
platform focused on Tampa Bay law enforcement accountability. It automates news scanning,
FOIA request generation, and bodycam video processing for YouTube.

Key Features:
- Automated news scanning for law enforcement incidents
- AI-powered FOIA request generation
- Email-based FOIA submission and monitoring
- Video processing and publishing to YouTube
- Revenue tracking and ROI analysis
- Comprehensive audit logging and analytics
"""

from __future__ import annotations

import logging
import sys

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.agencies import router as agencies_router
from app.api.analytics import router as analytics_router
from app.api.audit_logs import router as audit_logs_router
from app.api.auth import router as auth_router
from app.api.circuit_breakers import router as circuit_breakers_router
from app.api.dashboard import router as dashboard_router
from app.api.exports import router as exports_router
from app.api.foia import router as foia_router
from app.api.health import router as health_router
from app.api.news import router as news_router
from app.api.notifications import router as notifications_router
from app.api.settings import router as settings_router
from app.api.videos import router as videos_router
from app.config import settings

structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
    context_class=dict,
    logger_factory=structlog.PrintLoggerFactory(file=sys.stdout),
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()

app = FastAPI(
    title="FOIAPIPE",
    description=(
        "FOIA request pipeline and video publishing platform for law enforcement "
        "accountability. Automates news scanning, FOIA requests, video processing, "
        "and YouTube publishing."
    ),
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# ── CORS ──────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────
app.include_router(health_router)
app.include_router(analytics_router)
app.include_router(audit_logs_router)
app.include_router(auth_router)
app.include_router(circuit_breakers_router)
app.include_router(dashboard_router)
app.include_router(exports_router)
app.include_router(agencies_router)
app.include_router(foia_router)
app.include_router(news_router)
app.include_router(notifications_router)
app.include_router(settings_router)
app.include_router(videos_router)


@app.on_event("startup")
async def on_startup() -> None:
    logger.info("FOIAPIPE starting", version="1.0.0")


# ── Root health endpoint ──────────────────────────────────────────────────
@app.get("/")
async def root() -> dict[str, str]:
    """Root endpoint - returns API information.

    Returns basic API metadata and links to documentation.
    For comprehensive health checks, use /api/health endpoint.
    """
    return {
        "app": "FOIAPIPE",
        "version": "1.0.0",
        "description": "FOIA request pipeline and video publishing platform",
        "docs": "/api/docs",
        "health": "/api/health",
    }
