"""Integration tests for News API endpoints."""

import uuid
from datetime import datetime, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.news_article import NewsArticle


# ── Helpers ──────────────────────────────────────────────────────────────


async def _seed_article(db: AsyncSession, **overrides) -> NewsArticle:
    defaults = {
        "url": f"https://example.com/article-{uuid.uuid4().hex[:8]}",
        "headline": "Officer-involved incident on Main St",
        "source": "Tampa Bay Times",
        "published_at": datetime(2026, 1, 15, tzinfo=timezone.utc),
        "detected_agency": "Tampa Police Department",
    }
    defaults.update(overrides)
    article = NewsArticle(**defaults)
    db.add(article)
    await db.flush()
    return article


# ── Tests ────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_list_articles(client: AsyncClient, db_session: AsyncSession):
    """GET /api/news returns paginated article list."""
    for i in range(3):
        await _seed_article(db_session, headline=f"Headline {i}")
    await db_session.commit()

    response = await client.get("/api/news")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 3
    assert len(data["items"]) == 3


@pytest.mark.asyncio
async def test_list_articles_filter_source(client: AsyncClient, db_session: AsyncSession):
    """GET /api/news?source= filters by source."""
    await _seed_article(db_session, source="Tampa Bay Times")
    await _seed_article(db_session, source="Fox 13")
    await db_session.commit()

    response = await client.get("/api/news?source=Fox 13")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["source"] == "Fox 13"


@pytest.mark.asyncio
async def test_list_articles_pagination(client: AsyncClient, db_session: AsyncSession):
    """GET /api/news supports pagination."""
    for i in range(5):
        await _seed_article(db_session, headline=f"Article {i}")
    await db_session.commit()

    response = await client.get("/api/news?page=1&page_size=2")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 5
    assert len(data["items"]) == 2
    assert data["page"] == 1


@pytest.mark.asyncio
async def test_get_article(client: AsyncClient, db_session: AsyncSession):
    """GET /api/news/{id} returns single article."""
    article = await _seed_article(db_session, headline="Specific Article")
    await db_session.commit()

    response = await client.get(f"/api/news/{article.id}")
    assert response.status_code == 200
    data = response.json()
    assert data["headline"] == "Specific Article"
    assert data["id"] == str(article.id)


@pytest.mark.asyncio
async def test_get_article_not_found(client: AsyncClient):
    """GET /api/news/{id} returns 404 for unknown ID."""
    response = await client.get(f"/api/news/{uuid.uuid4()}")
    assert response.status_code == 404
