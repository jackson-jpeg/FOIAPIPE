"""Celery tasks for news scanning and classification."""

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


async def _scan_rss_async():
    from app.database import async_session_factory
    from app.models.news_article import NewsArticle
    from app.services.article_classifier import classify_and_score_article
    from app.services.news_scanner import scan_all_rss
    from sqlalchemy import select

    async with async_session_factory() as db:
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
                logger.error(f"Classification error for article {article.id}: {e}")

        await db.commit()
        return result


async def _scan_scrape_async():
    from app.database import async_session_factory
    from app.models.news_article import NewsArticle
    from app.services.article_classifier import classify_and_score_article
    from app.services.news_scanner import scrape_article
    from sqlalchemy import select

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
                logger.error(f"Scrape error for {article.url}: {e}")

        await db.commit()
        return {"scraped": scraped_count}


@celery_app.task(name="app.tasks.news_tasks.scan_news_rss", bind=True, max_retries=3)
def scan_news_rss(self):
    """Scan all configured RSS feeds for new articles."""
    logger.info("Starting RSS scan")
    try:
        result = _run_async(_scan_rss_async())
        logger.info(f"RSS scan complete: {result}")
        return result
    except Exception as exc:
        logger.error(f"RSS scan failed: {exc}")
        raise self.retry(exc=exc, countdown=60)


@celery_app.task(name="app.tasks.news_tasks.scan_news_scrape", bind=True, max_retries=3)
def scan_news_scrape(self):
    """Scrape full article bodies for articles missing body text."""
    logger.info("Starting article scrape")
    try:
        result = _run_async(_scan_scrape_async())
        logger.info(f"Scrape complete: {result}")
        return result
    except Exception as exc:
        logger.error(f"Scrape failed: {exc}")
        raise self.retry(exc=exc, countdown=120)
