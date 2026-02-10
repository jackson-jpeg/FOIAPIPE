"""Health check endpoints for system monitoring.

These endpoints provide health status information for all system dependencies
and are specifically designed for monitoring and alerting systems.

Authentication is NOT required for these endpoints to allow external health
checks and monitoring services to access them.

Endpoints:
- GET /api/health - Basic health check (fast, minimal overhead)
- GET /api/health/detailed - Comprehensive system health check

The detailed health check validates:
- Database connectivity and query execution
- Redis connectivity
- S3/R2 storage configuration
- Circuit breaker status
- Database migration status
- Email (SMTP) configuration
- Claude API configuration
"""

from __future__ import annotations

import logging
import platform
import sys
from datetime import datetime, timezone
from typing import Any

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/health", tags=["health"])


@router.get("")
async def health_basic() -> dict[str, Any]:
    """Basic health check endpoint.

    Returns a simple OK status with minimal overhead.
    Useful for load balancer health checks and uptime monitoring.

    Returns:
        status, timestamp, version, python_version

    Note:
        This endpoint does not check dependencies - it only confirms
        the application is running and can respond to HTTP requests.
    """
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": "1.0.0",
        "python": f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
    }


@router.get("/detailed")
async def health_detailed(
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Comprehensive health check for all system dependencies.

    Checks connectivity and configuration for all critical and optional
    system dependencies. Each check is independent - failure of one check
    does not prevent others from running.

    Returns:
        Dictionary containing:
            - status: Overall status ("ok" or "degraded")
            - timestamp: Current timestamp
            - checks: Dictionary of individual component checks, each with:
                - status: Component status ("ok", "error", "not_configured", "degraded")
                - Additional component-specific fields
                - error: Error message if check failed

    Component Checks:
        - database: PostgreSQL connectivity and query execution
        - redis: Redis connectivity
        - storage: S3/R2 storage availability
        - circuit_breakers: News source health summary
        - migrations: Database schema validation
        - email_smtp: SMTP configuration check
        - claude_api: Claude API key configuration

    Status Levels:
        - "ok": All critical services operational
        - "degraded": One or more critical services down (database or redis)
        - "not_configured": Service not configured (non-critical)
        - "error": Service configured but failing

    Note:
        Critical services for overall "ok" status: database, redis
        All other services are optional and won't cause "degraded" status
    """
    checks: dict[str, Any] = {}

    # 1. Database connectivity and query
    try:
        result = await db.execute(text("SELECT 1 as health"))
        row = result.scalar_one()
        checks["database"] = {"status": "ok", "query_result": row}
    except Exception as exc:
        checks["database"] = {"status": "error", "error": str(exc)}

    # 2. Redis connectivity
    try:
        r = aioredis.from_url(settings.REDIS_URL)
        try:
            await r.ping()
            checks["redis"] = {"status": "ok"}
        finally:
            await r.aclose()
    except Exception as exc:
        checks["redis"] = {"status": "error", "error": str(exc)}

    # 3. Storage (S3/R2) check
    try:
        from app.services.storage import test_storage_connection
        storage_ok = test_storage_connection()
        checks["storage"] = {"status": "ok" if storage_ok else "not_configured"}
    except Exception as exc:
        checks["storage"] = {"status": "error", "error": str(exc)}

    # 4. Circuit breaker health summary
    try:
        from app.services.circuit_breaker import get_source_health_summary
        circuit_summary = await get_source_health_summary(db)
        checks["circuit_breakers"] = {
            "status": "ok" if circuit_summary["circuits_open"] == 0 else "degraded",
            "healthy_sources": circuit_summary["healthy_sources"],
            "circuits_open": circuit_summary["circuits_open"],
            "total_sources": circuit_summary["total_sources"],
        }
    except Exception as exc:
        checks["circuit_breakers"] = {"status": "error", "error": str(exc)}

    # 5. Database migration status
    try:
        from sqlalchemy import inspect
        tables = await db.run_sync(
            lambda sync_session: inspect(sync_session.get_bind()).get_table_names()
        )
        expected_tables = [
            "news_articles",
            "foia_requests",
            "agencies",
            "videos",
            "news_source_health",
        ]
        missing_tables = [t for t in expected_tables if t not in tables]
        checks["migrations"] = {
            "status": "ok" if not missing_tables else "incomplete",
            "tables_found": len(tables),
            "missing_tables": missing_tables if missing_tables else None,
        }
    except Exception as exc:
        checks["migrations"] = {"status": "error", "error": str(exc)}

    # 6. SMTP email configuration (check config, don't send)
    smtp_configured = bool(
        settings.SMTP_HOST and settings.SMTP_PORT and settings.SMTP_USER
    )
    checks["email_smtp"] = {
        "status": "configured" if smtp_configured else "not_configured",
        "host": settings.SMTP_HOST or "not_set",
    }

    # 7. Claude API configuration
    checks["claude_api"] = {
        "status": "configured" if settings.ANTHROPIC_API_KEY else "not_configured"
    }

    # Overall status
    critical_services = ["database", "redis"]
    critical_ok = all(
        checks[svc].get("status") == "ok" for svc in critical_services if svc in checks
    )
    overall = "ok" if critical_ok else "degraded"

    # System information
    system_info = {
        "platform": platform.system(),
        "platform_version": platform.release(),
        "python_version": f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
        "debug_mode": settings.DEBUG,
    }

    return {
        "status": overall,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": "1.0.0",
        "environment": "development" if settings.DEBUG else "production",
        "system": system_info,
        "checks": checks,
    }
