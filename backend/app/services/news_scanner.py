"""RSS feed scanning and article scraping for Tampa Bay news sources.

This module provides functionality to:
- Scan multiple RSS feeds for law enforcement news
- Parse and extract article metadata
- Detect duplicate articles using fuzzy matching
- Track scanning statistics and errors via circuit breakers
- Filter articles for relevance before storing
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional
from urllib.parse import urljoin

import feedparser
import httpx
from bs4 import BeautifulSoup
from rapidfuzz import fuzz
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.news_article import NewsArticle
from app.models.scan_log import ScanLog, ScanStatus, ScanType

logger = logging.getLogger(__name__)

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
    {"url": "https://www.wtsp.com/feeds/syndication/rss/news/local", "source": "10 Tampa Bay / WTSP"},
    {"url": "https://www.baynews9.com/fl/tampa/news.rss", "source": "Bay News 9"},
    {"url": "https://www.wfts.com/news/local-news.rss", "source": "WFTS Tampa Bay"},
]

DEDUP_SIMILARITY_THRESHOLD = 85
DEDUP_LOOKBACK_DAYS = 7


async def _load_rss_feeds_from_db(db: AsyncSession) -> list[dict]:
    """Load active RSS feeds from the news_sources table, fall back to hardcoded if empty."""
    from app.models.news_source import NewsSource, SourceType

    result = await db.execute(
        select(NewsSource).where(
            NewsSource.source_type == SourceType.rss,
            NewsSource.is_active == True,
        )
    )
    sources = result.scalars().all()
    if not sources:
        return RSS_FEEDS
    return [{"url": s.url, "source": s.name, "db_id": str(s.id)} for s in sources]


async def _load_web_sources_from_db(db: AsyncSession) -> list[dict]:
    """Load active web scrape sources from the news_sources table, fall back to hardcoded if empty."""
    from app.models.news_source import NewsSource, SourceType

    result = await db.execute(
        select(NewsSource).where(
            NewsSource.source_type == SourceType.web_scrape,
            NewsSource.is_active == True,
        )
    )
    sources = result.scalars().all()
    if not sources:
        return WEB_SOURCES
    return [
        {
            "url": s.url,
            "source": s.name,
            "selectors": (s.selectors or {}).get("selectors", []),
            "db_id": str(s.id),
        }
        for s in sources
    ]


async def _update_source_scan_status(
    db: AsyncSession, db_id: str | None, error: str | None = None
) -> None:
    """Update last_scanned_at and error tracking on a NewsSource row."""
    if not db_id:
        return
    from app.models.news_source import NewsSource

    source = await db.get(NewsSource, db_id)
    if not source:
        return
    source.last_scanned_at = datetime.now(timezone.utc)
    if error:
        source.error_count = (source.error_count or 0) + 1
        source.last_error = error[:500]
    else:
        source.error_count = 0
        source.last_error = None


async def scan_rss_feed(feed_url: str, source_name: str, db: AsyncSession) -> dict:
    """Parse a single RSS feed and return statistics.

    Args:
        feed_url: URL of the RSS feed to scan
        source_name: Display name of the news source
        db: Async database session

    Returns:
        Dictionary containing scan statistics:
            - found: Total articles found in feed
            - new: New articles saved to database
            - duplicate: Articles skipped as duplicates
            - filtered: Articles filtered out as irrelevant
            - errors: Number of errors encountered
            - skipped: Whether scan was skipped due to circuit breaker
            - skip_reason: Reason for skipping (if skipped)
            - error_message: Error message (if errors occurred)

    Raises:
        No exceptions raised - all errors are caught and returned in stats
    """
    from app.services.circuit_breaker import should_skip_source, record_success, record_failure

    stats: dict = {
        "found": 0,
        "new": 0,
        "duplicate": 0,
        "filtered": 0,
        "errors": 0,
        "skipped": False,
        "skip_reason": None,
    }

    # Check circuit breaker
    should_skip, skip_reason = await should_skip_source(db, source_name)
    if should_skip:
        stats["skipped"] = True
        stats["skip_reason"] = skip_reason
        logger.info(f"Skipping {source_name}: {skip_reason}")
        return stats

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                feed_url,
                follow_redirects=True,
                headers={"User-Agent": "Mozilla/5.0 (compatible; FOIAArchive/1.0)"},
            )
            response.raise_for_status()

        feed = feedparser.parse(response.text)

        for entry in feed.entries:
            stats["found"] += 1
            url = entry.get("link", "")
            headline = entry.get("title", "")
            summary = entry.get("summary", "")

            # Pre-filter: check relevance before saving
            from app.services.article_classifier import is_article_relevant

            is_relevant, reason = is_article_relevant(headline, summary)
            if not is_relevant:
                stats["filtered"] += 1
                logger.debug(f"Filtered article: {headline[:50]}... (reason: {reason})")
                continue

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

        # Record success in circuit breaker
        await record_success(db, source_name, feed_url)

    except Exception as e:
        stats["errors"] += 1
        stats["error_message"] = str(e)
        logger.error(f"Error scanning {source_name}: {e}")

        # Record failure in circuit breaker
        await record_failure(db, source_name, feed_url, str(e))

    return stats


async def scan_all_rss(db: AsyncSession) -> dict:
    """Scan all configured RSS feeds and aggregate results.

    Creates a scan log entry to track the operation, then scans each
    configured RSS feed in sequence. Handles errors gracefully and
    records aggregate statistics.

    Args:
        db: Async database session

    Returns:
        Dictionary containing aggregate scan statistics:
            - found: Total articles found across all feeds
            - new: Total new articles saved
            - duplicate: Total duplicates skipped
            - filtered: Total articles filtered as irrelevant
            - skipped: Number of sources skipped due to circuit breaker
            - errors: Total errors encountered
    """
    log = ScanLog(
        scan_type=ScanType.rss,
        status=ScanStatus.running,
        started_at=datetime.now(timezone.utc),
        source="all_rss",
    )
    db.add(log)
    await db.flush()

    total: dict = {
        "found": 0,
        "new": 0,
        "duplicate": 0,
        "filtered": 0,
        "skipped": 0,
        "errors": 0,
    }
    error_messages: list[str] = []
    skipped_sources: list[str] = []

    try:
        feeds = await _load_rss_feeds_from_db(db)
        for feed in feeds:
            stats = await scan_rss_feed(feed["url"], feed["source"], db)
            total["found"] += stats["found"]
            total["new"] += stats["new"]
            total["duplicate"] += stats["duplicate"]
            total["filtered"] += stats.get("filtered", 0)
            total["errors"] += stats["errors"]

            if stats.get("skipped"):
                total["skipped"] += 1
                skipped_sources.append(f"{feed['source']} ({stats['skip_reason']})")

            if "error_message" in stats:
                error_messages.append(f"{feed['source']}: {stats['error_message']}")

            # Update DB source tracking
            await _update_source_scan_status(
                db, feed.get("db_id"), stats.get("error_message")
            )

        log.status = ScanStatus.completed
        logger.info(
            f"RSS scan complete: {total['found']} found, {total['new']} new, "
            f"{total['duplicate']} duplicate, {total['filtered']} filtered, "
            f"{total['skipped']} skipped"
        )
        if skipped_sources:
            logger.info(f"Skipped sources: {', '.join(skipped_sources)}")
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
    """Scrape full article body and HTML from a URL.

    Attempts to extract article text using common CSS selectors
    for article body content. Falls back to full page text if
    specific selectors don't match.

    Args:
        url: URL of the article to scrape

    Returns:
        Dictionary containing:
            - body: Extracted article text
            - raw_html: Complete HTML response

    Raises:
        httpx.HTTPError: If the HTTP request fails
        httpx.TimeoutException: If request times out (30s)
    """
    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        response = await client.get(
            url,
            headers={"User-Agent": "Mozilla/5.0 (compatible; FOIAArchive/1.0)"},
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


WEB_SOURCES = [
    {
        "url": "https://www.tampabay.com/news/crime/",
        "source": "Tampa Bay Times",
        "selectors": ["h2.StoryCard_headline a", "h3.PromoCard_headline a"],
    },
    {
        "url": "https://spectrumlocalnews.com/fl/tampa",
        "source": "Spectrum News / Bay News 9",
        "selectors": ["a.heading", "h3 a", "a[data-testid='story-card-link']"],
    },
]


async def scrape_web_source(source: dict, db: AsyncSession) -> dict:
    """Scrape a web page for article links and headlines.

    Args:
        source: Dict with url, source name, and CSS selectors
        db: Async database session

    Returns:
        Stats dict with found, new, duplicate, filtered, errors counts.
    """
    from app.services.article_classifier import is_article_relevant
    from app.services.circuit_breaker import should_skip_source, record_success, record_failure

    stats: dict = {"found": 0, "new": 0, "duplicate": 0, "filtered": 0, "errors": 0, "skipped": False}

    should_skip, skip_reason = await should_skip_source(db, source["source"])
    if should_skip:
        stats["skipped"] = True
        stats["skip_reason"] = skip_reason
        return stats

    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            response = await client.get(
                source["url"],
                headers={"User-Agent": "Mozilla/5.0 (compatible; FOIAArchive/1.0)"},
            )
            response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")

        links = []
        for selector in source["selectors"]:
            for el in soup.select(selector):
                href = el.get("href", "")
                text = el.get_text(strip=True)
                if href and text:
                    # Resolve relative URLs
                    if href.startswith("/"):
                        href = urljoin(source["url"], href)
                    links.append({"url": href, "headline": text})

        for link in links:
            stats["found"] += 1
            url = link["url"]
            headline = link["headline"]

            is_relevant, reason = is_article_relevant(headline)
            if not is_relevant:
                stats["filtered"] += 1
                continue

            is_dup = await _is_duplicate(url, headline, db)
            if is_dup:
                stats["duplicate"] += 1
                continue

            article = NewsArticle(
                url=url,
                headline=headline,
                source=source["source"],
            )
            db.add(article)
            stats["new"] += 1

        await db.flush()
        await record_success(db, source["source"], source["url"])

    except Exception as e:
        stats["errors"] += 1
        stats["error_message"] = str(e)
        logger.error(f"Error scraping {source['source']}: {e}")
        await record_failure(db, source["source"], source["url"], str(e))

    return stats


async def scan_all_web_sources(db: AsyncSession) -> dict:
    """Scrape all configured web sources and aggregate results."""
    log = ScanLog(
        scan_type=ScanType.scrape,
        status=ScanStatus.running,
        started_at=datetime.now(timezone.utc),
        source="all_web",
    )
    db.add(log)
    await db.flush()

    total: dict = {"found": 0, "new": 0, "duplicate": 0, "filtered": 0, "errors": 0}

    try:
        web_sources = await _load_web_sources_from_db(db)
        for source in web_sources:
            stats = await scrape_web_source(source, db)
            total["found"] += stats["found"]
            total["new"] += stats["new"]
            total["duplicate"] += stats["duplicate"]
            total["filtered"] += stats.get("filtered", 0)
            total["errors"] += stats["errors"]

            # Update DB source tracking
            await _update_source_scan_status(
                db, source.get("db_id"), stats.get("error_message")
            )

        log.status = ScanStatus.completed
        logger.info(
            f"Web scrape complete: {total['found']} found, {total['new']} new, "
            f"{total['duplicate']} duplicate, {total['filtered']} filtered"
        )
    except Exception as exc:
        log.status = ScanStatus.failed
        log.error_message = str(exc)

    log.completed_at = datetime.now(timezone.utc)
    log.articles_found = total["found"]
    log.articles_new = total["new"]
    log.articles_duplicate = total["duplicate"]
    if log.started_at:
        log.duration_seconds = (log.completed_at - log.started_at).total_seconds()

    await db.commit()
    return total


async def _is_duplicate(url: str, headline: str, db: AsyncSession) -> bool:
    """Check if article already exists by URL or fuzzy headline match.

    Performs two checks:
    1. Exact URL match (fast lookup)
    2. Fuzzy headline matching within lookback period (prevents near-duplicates)

    Args:
        url: Article URL to check
        headline: Article headline for fuzzy matching
        db: Async database session

    Returns:
        True if article is a duplicate (should be skipped), False otherwise

    Note:
        Uses token_sort_ratio similarity threshold of 85% and looks back 7 days.
        These constants are defined in DEDUP_SIMILARITY_THRESHOLD and DEDUP_LOOKBACK_DAYS.
    """
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
