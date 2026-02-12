"""Celery task for auto-publishing scheduled videos."""

import asyncio
import logging
from datetime import datetime, timezone

from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


def _run_async(coro):
    """Helper to run async code in sync Celery tasks."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


async def _publish_scheduled_async():
    from sqlalchemy import select

    from app.database import async_session_factory
    from app.models.video import Video, VideoStatus

    async with async_session_factory() as db:
        now = datetime.now(timezone.utc)

        stmt = select(Video).where(
            Video.status == VideoStatus.scheduled,
            Video.scheduled_at.isnot(None),
            Video.scheduled_at <= now,
        )
        result = await db.execute(stmt)
        videos = result.scalars().all()

        if not videos:
            return {"published": 0}

        from app.tasks.youtube_tasks import upload_video

        count = 0
        for video in videos:
            try:
                upload_video.delay(str(video.id))
                count += 1
                logger.info(f"Triggered upload for scheduled video {video.id}")
            except Exception as e:
                logger.error(f"Failed to trigger upload for video {video.id}: {e}")

        return {"published": count}


@celery_app.task(name="app.tasks.publish_tasks.publish_scheduled_videos")
def publish_scheduled_videos():
    """Check for scheduled videos whose publish time has arrived and trigger upload."""
    logger.info("Checking for scheduled videos to publish")
    try:
        result = _run_async(_publish_scheduled_async())
        logger.info(f"Scheduled publish check: {result}")
        return result
    except Exception as e:
        logger.error(f"Scheduled publish check failed: {e}")
        return {"error": str(e)}
