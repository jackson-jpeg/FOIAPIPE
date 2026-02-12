"""Celery tasks for notifications and daily summaries."""

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


async def _daily_summary_async():
    from sqlalchemy import select, func

    from app.database import async_session_factory
    from app.models.foia_request import FoiaRequest
    from app.models.news_article import NewsArticle
    from app.models.video import Video
    from app.services.notification_sender import send_notification

    async with async_session_factory() as db:
        yesterday = datetime.now(timezone.utc) - timedelta(days=1)

        new_articles = (
            await db.execute(
                select(func.count(NewsArticle.id)).where(
                    NewsArticle.created_at >= yesterday
                )
            )
        ).scalar() or 0

        active_foias = (
            await db.execute(
                select(func.count(FoiaRequest.id)).where(
                    FoiaRequest.status.not_in(["closed", "denied", "fulfilled"])
                )
            )
        ).scalar() or 0

        videos_in_pipeline = (
            await db.execute(
                select(func.count(Video.id)).where(Video.status != "published")
            )
        ).scalar() or 0

        summary = (
            f"Daily Summary:\n"
            f"- {new_articles} new articles discovered\n"
            f"- {active_foias} active FOIA requests\n"
            f"- {videos_in_pipeline} videos in pipeline"
        )

        await send_notification("daily_summary", {
            "title": "FOIA Archive Daily Summary",
            "message": summary,
        })

        return {"sent": True}


@celery_app.task(name="app.tasks.notification_tasks.generate_daily_summary")
def generate_daily_summary():
    """Generate and send a daily pipeline summary."""
    logger.info("Generating daily summary")
    try:
        result = _run_async(_daily_summary_async())
        return result
    except Exception as e:
        logger.error(f"Daily summary failed: {e}")
        return {"error": str(e)}


@celery_app.task(name="app.tasks.notification_tasks.send_notification_task")
def send_notification_task(event_type: str, data: dict):
    """Send a notification asynchronously."""
    from app.services.notification_sender import send_notification

    try:
        _run_async(send_notification(event_type, data))
        return {"sent": True}
    except Exception as e:
        logger.error(f"Notification failed: {e}")
        return {"error": str(e)}
