"""RSS feed scanning and article scraping for Tampa Bay news sources."""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from typing import Optional

import feedparser
import httpx
from bs4 import BeautifulSoup
from rapidfuzz import fuzz
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.news_article import NewsArticle
from app.models.scan_log import ScanLog, ScanStatus, ScanType

# Tampa Bay area RSS feeds — validated 2026-02-09
RSS_FEEDS = [
    {"url": "https://www.wfla.com/news/crime/feed/", "source": "WFLA"},
    {"url": "https://www.wfla.com/news/local-news/feed/", "source": "WFLA Local"},
    {"url": "https://www.fox13news.com/rss/category/local-news", "source": "Fox 13"},
    {"url": "https://www.abcactionnews.com/news/crime.rss", "source": "ABC Action News"},
    {"url": "https://www.abcactionnews.com/news/local-news.rss", "source": "ABC Action News Local"},
    {
        "url": (
            "https://news.google.com/rss/search?"
            "q=Tampa+Bay+police+%22officer-involved%22+OR+%22shooting%22+"
            "OR+%22arrest%22+OR+%22bodycam%22+OR+%22use+of+force%22"
            "&hl=en-US&gl=US&ceid=US:en"
        ),
        "source": "Google News",
    },
]

DEDUP_SIMILARITY_THRESHOLD = 85
DEDUP_LOOKBACK_DAYS = 7


async def scan_rss_feed(feed_url: str, source_name: str, db: AsyncSession) -> dict:
    """Parse a single RSS feed and return stats."""
    stats: dict = {"found": 0, "new": 0, "duplicate": 0, "errors": 0}
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                feed_url,
                follow_redirects=True,
                headers={"User-Agent": "Mozilla/5.0 (compatible; FOIAPipe/1.0)"},
            )
            response.raise_for_status()

        feed = feedparser.parse(response.text)

        for entry in feed.entries:
            stats["found"] += 1
            url = entry.get("link", "")
            headline = entry.get("title", "")
            summary = entry.get("summary", "")

            published: datetime | None = None
            if hasattr(entry, "published_parsed") and entry.published_parsed:
                published = datetime(*entry.published_parsed[:6], tzinfo=timezone.utc)

            is_dup = await _is_duplicate(url, headline, db)
            if is_dup:
                stats["duplicate"] += 1
                continue

            article = NewsArticle(
                url=url,
                headline=headline,
                source=source_name,
                summary=summary,
                published_at=published,
            )
            db.add(article)
            stats["new"] += 1

        await db.flush()
    except Exception as e:
        stats["errors"] += 1
        stats["error_message"] = str(e)

    return stats


async def scan_all_rss(db: AsyncSession) -> dict:
    """Scan all configured RSS feeds. Returns aggregate stats."""
    log = ScanLog(
        scan_type=ScanType.rss,
        status=ScanStatus.running,
        started_at=datetime.now(timezone.utc),
        source="all_rss",
    )
    db.add(log)
    await db.flush()

    total: dict = {"found": 0, "new": 0, "duplicate": 0, "errors": 0}
    error_messages: list[str] = []

    try:
        for feed in RSS_FEEDS:
            stats = await scan_rss_feed(feed["url"], feed["source"], db)
            total["found"] += stats["found"]
            total["new"] += stats["new"]
            total["duplicate"] += stats["duplicate"]
            total["errors"] += stats["errors"]
            if "error_message" in stats:
                error_messages.append(f"{feed['source']}: {stats['error_message']}")

        log.status = ScanStatus.completed
    except Exception as exc:
        log.status = ScanStatus.failed
        error_messages.append(f"Fatal: {exc}")

    log.completed_at = datetime.now(timezone.utc)
    log.articles_found = total["found"]
    log.articles_new = total["new"]
    log.articles_duplicate = total["duplicate"]
    if error_messages:
        log.error_message = "; ".join(error_messages)
    if log.started_at:
        log.duration_seconds = (log.completed_at - log.started_at).total_seconds()

    await db.commit()
    return total


async def scrape_article(url: str) -> dict:
    """Scrape full article body from URL."""
    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        response = await client.get(
            url,
            headers={"User-Agent": "Mozilla/5.0 (compatible; FOIAPipe/1.0)"},
        )
        response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")

    # Try common article body selectors
    body = ""
    for selector in [
        "article",
        ".article-body",
        ".story-body",
        ".entry-content",
        "main",
    ]:
        el = soup.select_one(selector)
        if el:
            body = el.get_text(separator="\n", strip=True)
            break

    if not body:
        body = soup.get_text(separator="\n", strip=True)[:5000]

    return {"body": body, "raw_html": response.text}


async def _is_duplicate(url: str, headline: str, db: AsyncSession) -> bool:
    """Check if article already exists by URL or fuzzy headline match."""
    # Exact URL match
    result = await db.execute(
        select(NewsArticle).where(NewsArticle.url == url).limit(1)
    )
    if result.scalar_one_or_none():
        return True

    # Fuzzy headline match within lookback period
    cutoff = datetime.now(timezone.utc) - timedelta(days=DEDUP_LOOKBACK_DAYS)
    result = await db.execute(
        select(NewsArticle.headline).where(NewsArticle.created_at >= cutoff)
    )
    existing_headlines = [row[0] for row in result.all()]
    for existing in existing_headlines:
        if fuzz.token_sort_ratio(headline, existing) > DEDUP_SIMILARITY_THRESHOLD:
            return True

    return False
