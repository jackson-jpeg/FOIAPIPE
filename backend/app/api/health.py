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

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
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
    _user: str = Depends(get_current_user),
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
        from app.services.cache import get_redis
        r = await get_redis()
        await r.ping()
        checks["redis"] = {"status": "ok"}
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


# ── Celery Task Status (separate prefix) ─────────────────────────────────

tasks_router = APIRouter(prefix="/api/tasks", tags=["tasks"])


@tasks_router.get("/status")
async def celery_task_status(
    _user: str = Depends(get_current_user),
) -> dict[str, Any]:
    """Return Celery beat schedule, worker status, and recent task info.

    Requires authentication. Provides visibility into background task health.
    """
    from app.tasks.beat_schedule import CELERY_BEAT_SCHEDULE

    # Format beat schedule for display
    schedule_info = {}
    for name, config in CELERY_BEAT_SCHEDULE.items():
        sched = config["schedule"]
        if isinstance(sched, (int, float)):
            interval_str = f"every {int(sched)}s ({int(sched) // 60}m)"
        else:
            interval_str = str(sched)
        schedule_info[name] = {
            "task": config["task"],
            "interval": interval_str,
        }

    # Try to ping workers
    worker_status: dict[str, Any] = {"status": "unknown"}
    try:
        from app.tasks.celery_app import celery_app

        inspect = celery_app.control.inspect(timeout=3.0)
        ping_result = inspect.ping()
        if ping_result:
            worker_status = {
                "status": "online",
                "workers": list(ping_result.keys()),
                "count": len(ping_result),
            }
        else:
            worker_status = {"status": "offline", "workers": [], "count": 0}
    except Exception as exc:
        worker_status = {"status": "error", "error": str(exc)}

    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "beat_schedule": schedule_info,
        "workers": worker_status,
    }


@tasks_router.get("/history")
async def task_history(
    limit: int = 20,
    task_name: str | None = None,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> dict[str, Any]:
    """Return recent task run history with success rates."""
    from sqlalchemy import case, func, select

    from app.models.task_run import TaskRun, TaskRunStatus

    # Recent runs
    stmt = select(TaskRun).order_by(TaskRun.started_at.desc()).limit(limit)
    if task_name:
        stmt = stmt.where(TaskRun.task_name == task_name)
    result = await db.execute(stmt)
    runs = result.scalars().all()

    # Per-task stats (last 24 hours)
    one_day_ago = datetime.now(timezone.utc) - __import__("datetime").timedelta(days=1)
    stats_stmt = (
        select(
            TaskRun.task_name,
            func.count(TaskRun.id).label("total"),
            func.count(case((TaskRun.status == TaskRunStatus.success, 1))).label("successes"),
            func.count(case((TaskRun.status == TaskRunStatus.failure, 1))).label("failures"),
            func.avg(TaskRun.duration_seconds).label("avg_duration"),
            func.max(TaskRun.started_at).label("last_run"),
        )
        .where(TaskRun.started_at >= one_day_ago)
        .group_by(TaskRun.task_name)
    )
    stats_result = await db.execute(stats_stmt)
    stats_rows = stats_result.all()

    task_stats = {}
    for row in stats_rows:
        total = row.total or 1
        task_stats[row.task_name] = {
            "total_24h": total,
            "successes": row.successes,
            "failures": row.failures,
            "success_rate": round((row.successes / total) * 100, 1),
            "avg_duration_seconds": round(row.avg_duration, 2) if row.avg_duration else None,
            "last_run": row.last_run.isoformat() if row.last_run else None,
        }

    return {
        "runs": [
            {
                "id": str(r.id),
                "task_name": r.task_name,
                "celery_task_id": r.celery_task_id,
                "started_at": r.started_at.isoformat() if r.started_at else None,
                "completed_at": r.completed_at.isoformat() if r.completed_at else None,
                "duration_seconds": r.duration_seconds,
                "status": r.status.value if r.status else None,
                "result_summary": r.result_summary,
                "error_message": r.error_message,
            }
            for r in runs
        ],
        "task_stats": task_stats,
        "total_runs": len(runs),
    }


@tasks_router.get("/health")
async def task_health(
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> dict[str, Any]:
    """Check health of all scheduled tasks — flags any task not run within 2x its expected interval."""
    from sqlalchemy import func, select

    from app.models.task_run import TaskRun, TaskRunStatus
    from app.tasks.beat_schedule import CELERY_BEAT_SCHEDULE

    now = datetime.now(timezone.utc)
    tasks_health = {}

    for schedule_name, config in CELERY_BEAT_SCHEDULE.items():
        task_full_name = config["task"]
        sched = config["schedule"]

        # Determine expected interval in seconds
        if isinstance(sched, (int, float)):
            expected_interval = sched
        else:
            # crontab — assume daily (86400s) for health check threshold
            expected_interval = 86400

        # Get last successful run
        last_run_result = await db.execute(
            select(TaskRun.started_at, TaskRun.status, TaskRun.duration_seconds, TaskRun.error_message)
            .where(TaskRun.task_name == task_full_name)
            .order_by(TaskRun.started_at.desc())
            .limit(1)
        )
        last_run = last_run_result.first()

        # Get last success
        last_success_result = await db.execute(
            select(TaskRun.started_at)
            .where(TaskRun.task_name == task_full_name, TaskRun.status == TaskRunStatus.success)
            .order_by(TaskRun.started_at.desc())
            .limit(1)
        )
        last_success = last_success_result.scalar_one_or_none()

        # Determine health status
        if last_run is None:
            health_status = "unknown"
            overdue_seconds = None
        else:
            last_run_time = last_run.started_at
            seconds_since = (now - last_run_time).total_seconds()
            overdue_threshold = expected_interval * 2

            if seconds_since > overdue_threshold:
                health_status = "red"
            elif seconds_since > expected_interval * 1.5:
                health_status = "amber"
            else:
                health_status = "green"

            overdue_seconds = max(0, seconds_since - expected_interval)

        # Format interval for display
        if isinstance(sched, (int, float)):
            interval_str = f"every {int(sched // 60)}m" if sched >= 60 else f"every {int(sched)}s"
        else:
            interval_str = str(sched)

        tasks_health[schedule_name] = {
            "task": task_full_name,
            "schedule": interval_str,
            "expected_interval_seconds": expected_interval,
            "health": health_status,
            "last_run": last_run.started_at.isoformat() if last_run else None,
            "last_status": last_run.status.value if last_run and last_run.status else None,
            "last_duration": round(last_run.duration_seconds, 2) if last_run and last_run.duration_seconds else None,
            "last_error": last_run.error_message[:200] if last_run and last_run.error_message else None,
            "last_success": last_success.isoformat() if last_success else None,
            "overdue_seconds": round(overdue_seconds) if overdue_seconds else None,
        }

    # Count statuses
    green = sum(1 for t in tasks_health.values() if t["health"] == "green")
    amber = sum(1 for t in tasks_health.values() if t["health"] == "amber")
    red = sum(1 for t in tasks_health.values() if t["health"] == "red")
    unknown = sum(1 for t in tasks_health.values() if t["health"] == "unknown")

    return {
        "timestamp": now.isoformat(),
        "summary": {"green": green, "amber": amber, "red": red, "unknown": unknown, "total": len(tasks_health)},
        "tasks": tasks_health,
    }


@tasks_router.post("/{schedule_name}/trigger")
async def trigger_task(
    schedule_name: str,
    _user: str = Depends(get_current_user),
) -> dict[str, Any]:
    """Manually trigger a scheduled Celery task by its schedule name."""
    from app.tasks.beat_schedule import CELERY_BEAT_SCHEDULE
    from app.tasks.celery_app import celery_app

    if schedule_name not in CELERY_BEAT_SCHEDULE:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"Unknown task: {schedule_name}")

    task_full_name = CELERY_BEAT_SCHEDULE[schedule_name]["task"]
    result = celery_app.send_task(task_full_name)

    return {
        "schedule_name": schedule_name,
        "task": task_full_name,
        "task_id": result.id,
        "status": "triggered",
    }
