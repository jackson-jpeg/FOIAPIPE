"""Tests for news scanner RSS parsing and dedup logic."""

import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch, MagicMock

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.news_article import NewsArticle
from app.services.news_scanner import (
    scan_rss_feed,
    _is_duplicate,
    DEDUP_SIMILARITY_THRESHOLD,
)


SAMPLE_RSS = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <item>
      <title>Officer-involved shooting in downtown Tampa</title>
      <link>https://example.com/ois-tampa</link>
      <description>Tampa Police responded to a shooting incident.</description>
      <pubDate>Mon, 09 Feb 2026 12:00:00 GMT</pubDate>
    </item>
    <item>
      <title>Bodycam footage released in St. Petersburg police pursuit</title>
      <link>https://example.com/bodycam-stpete</link>
      <description>St. Petersburg Police released bodycam footage of a pursuit.</description>
      <pubDate>Mon, 09 Feb 2026 10:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>"""


@pytest.mark.asyncio
async def test_scan_rss_feed_parses_entries(db_session: AsyncSession):
    """Test that scan_rss_feed parses RSS entries and inserts articles."""
    import httpx

    mock_response = MagicMock()
    mock_response.text = SAMPLE_RSS
    mock_response.status_code = 200
    mock_response.raise_for_status = MagicMock()

    with patch("app.services.news_scanner.httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client_cls.return_value = mock_client

        stats = await scan_rss_feed(
            "https://example.com/rss", "Test Source", db_session
        )

    assert stats["found"] == 2
    assert stats["new"] == 2
    assert stats["duplicate"] == 0
    assert stats["errors"] == 0


@pytest.mark.asyncio
async def test_exact_url_dedup(db_session: AsyncSession):
    """Test that exact URL match is detected as duplicate."""
    article = NewsArticle(
        url="https://example.com/test-article",
        headline="Test Article",
        source="Test",
    )
    db_session.add(article)
    await db_session.flush()

    is_dup = await _is_duplicate(
        "https://example.com/test-article", "Different Headline", db_session
    )
    assert is_dup is True


@pytest.mark.asyncio
async def test_fuzzy_headline_dedup(db_session: AsyncSession):
    """Test that similar headlines are detected as duplicates."""
    article = NewsArticle(
        url="https://example.com/original",
        headline="Officer-involved shooting in downtown Tampa leaves 1 dead",
        source="Tampa Bay Times",
    )
    db_session.add(article)
    await db_session.flush()

    # Very similar headline should be flagged
    is_dup = await _is_duplicate(
        "https://other-site.com/similar",
        "Officer-involved shooting in downtown Tampa leaves one dead",
        db_session,
    )
    assert is_dup is True


@pytest.mark.asyncio
async def test_different_headline_not_dedup(db_session: AsyncSession):
    """Test that genuinely different headlines are not flagged as duplicates."""
    article = NewsArticle(
        url="https://example.com/article-a",
        headline="Officer-involved shooting in downtown Tampa",
        source="Tampa Bay Times",
    )
    db_session.add(article)
    await db_session.flush()

    is_dup = await _is_duplicate(
        "https://example.com/article-b",
        "New restaurant opens on Davis Islands",
        db_session,
    )
    assert is_dup is False
