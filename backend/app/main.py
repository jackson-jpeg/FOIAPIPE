"""FastAPI application entry point for FOIA Archive.

FOIA Archive is a FOIA (Freedom of Information Act) request pipeline and video publishing
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
from contextlib import asynccontextmanager

import sentry_sdk
import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from starlette.middleware.base import BaseHTTPMiddleware

from app.api.agencies import router as agencies_router
from app.api.analytics import router as analytics_router
from app.api.audit_logs import router as audit_logs_router
from app.api.auth import router as auth_router
from app.api.circuit_breakers import router as circuit_breakers_router
from app.api.dashboard import router as dashboard_router
from app.api.exports import router as exports_router
from app.api.foia import router as foia_router
from app.api.health import router as health_router, tasks_router
from app.api.news import router as news_router
from app.api.notifications import router as notifications_router
from app.api.search import router as search_router
from app.api.settings import router as settings_router
from app.api.sse import router as sse_router
from app.api.videos import router as videos_router
from app.config import settings
from app.rate_limit import limiter

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


# ── Security Headers Middleware ───────────────────────────────────────────
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        if not settings.DEBUG:
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response


# ── Lifespan (startup + graceful shutdown) ────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("FOIA Archive starting up", version="1.0.0")
    try:
        from sqlalchemy import func, select

        from app.database import async_session_factory
        from app.models.agency import Agency
        from app.seed import seed_agencies

        async with async_session_factory() as db:
            count = (await db.execute(select(func.count(Agency.id)))).scalar_one()
        if count < 5:
            logger.info("Agency table under-populated, auto-seeding", current_count=count)
            await seed_agencies()
    except Exception as e:
        logger.warning("Auto-seed failed (non-fatal)", error=str(e))
    yield
    logger.info("FOIA Archive shutting down")
    from app.services.cache import close_redis
    try:
        await close_redis()
    except Exception:
        pass
    from app.database import engine
    await engine.dispose()
    logger.info("Shutdown complete")


# ── Sentry Error Tracking ─────────────────────────────────────────────────
if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment="production" if not settings.DEBUG else "development",
        traces_sample_rate=1.0 if settings.DEBUG else 0.1,  # 100% in dev, 10% in prod
        profiles_sample_rate=1.0 if settings.DEBUG else 0.1,
        enable_tracing=True,
    )
    logger.info("Sentry error tracking initialized", environment="production" if not settings.DEBUG else "development")

# ── FastAPI App ───────────────────────────────────────────────────────────
# Disable API docs in production for security
docs_url = "/api/docs" if settings.DEBUG else None
redoc_url = "/api/redoc" if settings.DEBUG else None

app = FastAPI(
    title="FOIA Archive",
    description=(
        "FOIA request pipeline and video publishing platform for law enforcement "
        "accountability. Automates news scanning, FOIA requests, video processing, "
        "and YouTube publishing."
    ),
    version="1.0.0",
    docs_url=docs_url,
    redoc_url=redoc_url,
    lifespan=lifespan,
)

# Add rate limiting state and exception handler
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── CORS ──────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(SecurityHeadersMiddleware)

# ── Routers ───────────────────────────────────────────────────────────────
app.include_router(health_router)
app.include_router(tasks_router)
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
app.include_router(search_router)
app.include_router(settings_router)
app.include_router(sse_router)
app.include_router(videos_router)


# ── Root health endpoint ──────────────────────────────────────────────────
@app.get("/")
async def root() -> dict[str, str]:
    """Root endpoint - returns API information.

    Returns basic API metadata and links to documentation.
    For comprehensive health checks, use /api/health endpoint.
    """
    return {
        "app": "FOIA Archive",
        "version": "1.0.0",
        "description": "FOIA request pipeline and video publishing platform",
        "docs": "/api/docs",
        "health": "/api/health",
    }
