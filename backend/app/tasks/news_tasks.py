"""Celery tasks for news scanning and classification."""

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


def _run_async(coro):
    """Run an async coroutine in a new event loop.

    Each Celery task invocation gets a fresh loop to avoid conflicts
    with the main asyncio loop or other tasks.
    """
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


async def _check_scan_running(db) -> bool:
    """Return True if an RSS scan is already running (idempotency guard)."""
    from sqlalchemy import select
    from app.models.scan_log import ScanLog, ScanStatus, ScanType

    cutoff = datetime.now(timezone.utc) - timedelta(minutes=30)
    result = await db.execute(
        select(ScanLog).where(
            ScanLog.scan_type == ScanType.rss,
            ScanLog.status == ScanStatus.running,
            ScanLog.started_at >= cutoff,
        ).limit(1)
    )
    return result.scalar_one_or_none() is not None


async def _scan_rss_async():
    from sqlalchemy import select
    from app.database import async_session_factory
    from app.models.news_article import NewsArticle
    from app.services.article_classifier import classify_and_score_article
    from app.services.news_scanner import scan_all_rss

    async with async_session_factory() as db:
        # Idempotency: skip if a scan is already in progress
        if await _check_scan_running(db):
            logger.info("RSS scan already running, skipping")
            return {"skipped": True, "reason": "scan_already_running"}

        result = await scan_all_rss(db)

        # Classify new unscored articles
        stmt = (
            select(NewsArticle)
            .where(NewsArticle.severity_score.is_(None))
            .order_by(NewsArticle.created_at.desc())
            .limit(100)
        )
        articles = (await db.execute(stmt)).scalars().all()

        for article in articles:
            try:
                await classify_and_score_article(article, db)
            except Exception as e:
                logger.error("Classification error for article %s: %s", article.id, e)

        await db.commit()
        return result


async def _scan_scrape_async():
    from sqlalchemy import select
    from app.database import async_session_factory
    from app.models.news_article import NewsArticle
    from app.services.article_classifier import classify_and_score_article
    from app.services.news_scanner import scrape_article

    async with async_session_factory() as db:
        # Find articles without body text
        stmt = (
            select(NewsArticle)
            .where(
                NewsArticle.body.is_(None),
                NewsArticle.is_dismissed.is_(False),
            )
            .order_by(NewsArticle.created_at.desc())
            .limit(20)
        )
        articles = (await db.execute(stmt)).scalars().all()

        scraped_count = 0
        for article in articles:
            try:
                result = await scrape_article(article.url)
                article.body = result.get("body")
                article.raw_html = result.get("raw_html")
                await classify_and_score_article(article, db)
                scraped_count += 1
            except Exception as e:
                logger.error("Scrape error for %s: %s", article.url, e)

        await db.commit()
        return {"scraped": scraped_count}


@celery_app.task(name="app.tasks.news_tasks.scan_news_rss", bind=True, max_retries=3)
def scan_news_rss(self):
    """Scan all configured RSS feeds for new articles."""
    logger.info("Starting RSS scan")
    try:
        result = _run_async(_scan_rss_async())
        logger.info("RSS scan complete: %s", result)
        return result
    except Exception as exc:
        logger.error("RSS scan failed: %s", exc)
        raise self.retry(exc=exc, countdown=60)


@celery_app.task(name="app.tasks.news_tasks.scan_news_scrape", bind=True, max_retries=3)
def scan_news_scrape(self):
    """Scrape full article bodies for articles missing body text."""
    logger.info("Starting article scrape")
    try:
        result = _run_async(_scan_scrape_async())
        logger.info("Scrape complete: %s", result)
        return result
    except Exception as exc:
        logger.error("Scrape failed: %s", exc)
        raise self.retry(exc=exc, countdown=120)


async def _scan_web_sources_async():
    from sqlalchemy import select
    from app.database import async_session_factory
    from app.models.news_article import NewsArticle
    from app.services.article_classifier import classify_and_score_article
    from app.services.news_scanner import scan_all_web_sources

    async with async_session_factory() as db:
        result = await scan_all_web_sources(db)

        # Classify new unscored articles from web sources
        stmt = (
            select(NewsArticle)
            .where(NewsArticle.severity_score.is_(None))
            .order_by(NewsArticle.created_at.desc())
            .limit(50)
        )
        articles = (await db.execute(stmt)).scalars().all()

        for article in articles:
            try:
                await classify_and_score_article(article, db)
            except Exception as e:
                logger.error("Classification error for article %s: %s", article.id, e)

        await db.commit()
        return result


@celery_app.task(name="app.tasks.news_tasks.scan_news_web_sources", bind=True, max_retries=3)
def scan_news_web_sources(self):
    """Scrape web sources (Tampa Bay Times, Spectrum News) for new articles."""
    logger.info("Starting web source scan")
    try:
        result = _run_async(_scan_web_sources_async())
        logger.info("Web source scan complete: %s", result)
        return result
    except Exception as exc:
        logger.error("Web source scan failed: %s", exc)
        raise self.retry(exc=exc, countdown=120)
