"""Integration tests for global search endpoint."""

import uuid
from datetime import datetime, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agency import Agency
from app.models.foia_request import FoiaRequest, FoiaStatus
from app.models.news_article import NewsArticle
from app.models.video import Video, VideoStatus


# ── Helpers ──────────────────────────────────────────────────────────────


async def _seed_data(db: AsyncSession):
    """Seed test data across all searchable tables."""
    agency = Agency(
        name="Tampa Police Department",
        abbreviation="TPD",
        foia_email="records@tampapd.example.com",
        state="FL",
    )
    db.add(agency)
    await db.flush()

    foia = FoiaRequest(
        case_number="FOIA-2026-0001",
        agency_id=agency.id,
        status=FoiaStatus.draft,
        request_text="Requesting bodycam footage from Tampa incident.",
    )
    db.add(foia)

    article = NewsArticle(
        url="https://example.com/tampa-shooting",
        headline="Tampa officer involved in shooting",
        source="Tampa Bay Times",
        published_at=datetime(2026, 1, 15, tzinfo=timezone.utc),
    )
    db.add(article)

    video = Video(
        title="Tampa Bodycam Footage",
        description="Raw bodycam from Tampa PD",
        status=VideoStatus.raw_received,
    )
    db.add(video)

    await db.flush()
    return agency, foia, article, video


# ── Tests ────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_search_returns_all_types(client: AsyncClient, db_session: AsyncSession):
    """GET /api/search?q=tampa returns results from all categories."""
    await _seed_data(db_session)
    await db_session.commit()

    response = await client.get("/api/search?q=tampa")
    assert response.status_code == 200
    data = response.json()["results"]
    assert len(data["foia"]) >= 1
    assert len(data["articles"]) >= 1
    assert len(data["videos"]) >= 1
    assert len(data["agencies"]) >= 1


@pytest.mark.asyncio
async def test_search_foia_by_case_number(client: AsyncClient, db_session: AsyncSession):
    """Search finds FOIA requests by case number."""
    await _seed_data(db_session)
    await db_session.commit()

    response = await client.get("/api/search?q=FOIA-2026-0001")
    assert response.status_code == 200
    data = response.json()["results"]
    assert len(data["foia"]) == 1
    assert data["foia"][0]["case_number"] == "FOIA-2026-0001"


@pytest.mark.asyncio
async def test_search_no_results(client: AsyncClient, db_session: AsyncSession):
    """Search returns empty categories for no matches."""
    await db_session.commit()

    response = await client.get("/api/search?q=zzzznonexistent")
    assert response.status_code == 200
    data = response.json()["results"]
    assert data["foia"] == []
    assert data["articles"] == []
    assert data["videos"] == []
    assert data["agencies"] == []


@pytest.mark.asyncio
async def test_search_query_too_short(client: AsyncClient):
    """Search rejects queries shorter than 2 characters."""
    response = await client.get("/api/search?q=a")
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_search_query_required(client: AsyncClient):
    """Search requires the q parameter."""
    response = await client.get("/api/search")
    assert response.status_code == 422
