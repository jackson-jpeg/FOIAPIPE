"""Celery tasks for maintenance operations."""

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


def _run_async(coro):
    """Helper to run async code in sync Celery tasks."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


async def _cleanup_async():
    from sqlalchemy import delete

    from app.database import async_session_factory
    from app.models.scan_log import ScanLog

    async with async_session_factory() as db:
        cutoff = datetime.now(timezone.utc) - timedelta(days=90)
        result = await db.execute(
            delete(ScanLog).where(ScanLog.started_at < cutoff)
        )
        await db.commit()
        return {"deleted": result.rowcount}


@celery_app.task(name="app.tasks.maintenance_tasks.cleanup_old_scanlogs")
def cleanup_old_scanlogs():
    """Delete scan logs older than 90 days."""
    logger.info("Cleaning up old scan logs")
    try:
        result = _run_async(_cleanup_async())
        logger.info(f"Cleanup: {result}")
        return result
    except Exception as e:
        logger.error(f"Cleanup failed: {e}")
        return {"error": str(e)}


async def _backup_database_async():
    import subprocess

    from app.config import settings

    db_url = settings.DATABASE_URL
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    backup_file = f"/tmp/foiaarchive_backup_{timestamp}.sql"

    try:
        result = subprocess.run(
            ["pg_dump", db_url, "-f", backup_file, "--no-owner", "--no-acl"],
            capture_output=True,
            text=True,
            timeout=600,
        )
        if result.returncode != 0:
            logger.error(f"pg_dump failed: {result.stderr}")
            return {"success": False, "error": result.stderr}

        import os
        size = os.path.getsize(backup_file)
        logger.info(f"Database backup created: {backup_file} ({size} bytes)")
        return {"success": True, "file": backup_file, "size_bytes": size}
    except FileNotFoundError:
        logger.warning("pg_dump not available, skipping backup")
        return {"success": False, "error": "pg_dump not found"}
    except subprocess.TimeoutExpired:
        logger.error("Database backup timed out")
        return {"success": False, "error": "timeout"}


@celery_app.task(name="app.tasks.maintenance_tasks.run_database_backup")
def run_database_backup():
    """Run a database backup using pg_dump."""
    logger.info("Starting database backup")
    try:
        result = _run_async(_backup_database_async())
        logger.info(f"Backup result: {result}")
        return result
    except Exception as e:
        logger.error(f"Backup failed: {e}")
        return {"error": str(e)}


# ── Agency Report Card Recalculation ──────────────────────────────────


async def _recalculate_grades_async():
    from app.database import async_session_factory
    from app.services.agency_grader import recalculate_all_grades

    async with async_session_factory() as db:
        result = await recalculate_all_grades(db)
        await db.commit()
        return result


@celery_app.task(name="app.tasks.maintenance_tasks.recalculate_agency_grades")
def recalculate_agency_grades():
    """Recalculate report card grades for all active agencies."""
    logger.info("Recalculating agency report card grades")
    try:
        result = _run_async(_recalculate_grades_async())
        logger.info(f"Grade recalculation: {result}")
        return result
    except Exception as e:
        logger.error(f"Grade recalculation failed: {e}")
        return {"error": str(e)}
