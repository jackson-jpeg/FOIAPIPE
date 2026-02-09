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
