"""Integration tests for FOIA API endpoints."""

import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agency import Agency
from app.models.foia_request import FoiaRequest, FoiaStatus
from app.models.news_article import NewsArticle


# ── Helpers ──────────────────────────────────────────────────────────────


async def _seed_agency(db: AsyncSession, **overrides) -> Agency:
    defaults = {
        "name": "Tampa Police Department",
        "abbreviation": "TPD",
        "foia_email": "records@tampapd.example.com",
        "state": "FL",
    }
    defaults.update(overrides)
    agency = Agency(**defaults)
    db.add(agency)
    await db.flush()
    return agency


async def _seed_article(db: AsyncSession, **overrides) -> NewsArticle:
    defaults = {
        "url": f"https://example.com/article-{uuid.uuid4().hex[:8]}",
        "headline": "Officer-involved shooting on Main St",
        "source": "Tampa Bay Times",
        "published_at": datetime(2026, 1, 15, tzinfo=timezone.utc),
        "detected_agency": "Tampa Police Department",
        "detected_officers": ["Officer Smith", "Officer Jones"],
        "detected_location": "100 Main St, Tampa",
    }
    defaults.update(overrides)
    article = NewsArticle(**defaults)
    db.add(article)
    await db.flush()
    return article


async def _seed_foia(db: AsyncSession, agency: Agency, **overrides) -> FoiaRequest:
    defaults = {
        "case_number": f"FOIA-2026-{uuid.uuid4().hex[:4].upper()}",
        "agency_id": agency.id,
        "status": FoiaStatus.draft,
        "request_text": "Test FOIA request text.",
    }
    defaults.update(overrides)
    foia = FoiaRequest(**defaults)
    db.add(foia)
    await db.flush()
    return foia


# ── Tests ────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_foia_request(client: AsyncClient, db_session: AsyncSession):
    """POST /api/foia creates a request with correct case number format."""
    agency = await _seed_agency(db_session)
    await db_session.commit()

    response = await client.post(
        "/api/foia",
        json={"agency_id": str(agency.id)},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["case_number"].startswith("FOIA-")
    assert data["status"] == "draft"
    assert data["agency_id"] == str(agency.id)


@pytest.mark.asyncio
async def test_create_foia_auto_generates_text(client: AsyncClient, db_session: AsyncSession):
    """Creating without request_text auto-generates FOIA language."""
    agency = await _seed_agency(db_session)
    await db_session.commit()

    response = await client.post(
        "/api/foia",
        json={"agency_id": str(agency.id)},
    )
    assert response.status_code == 201
    data = response.json()
    assert "Chapter 119" in data["request_text"]
    assert "Florida" in data["request_text"]


@pytest.mark.asyncio
async def test_create_foia_from_article(client: AsyncClient, db_session: AsyncSession):
    """Creating with news_article_id uses article data in generated text."""
    agency = await _seed_agency(db_session)
    article = await _seed_article(db_session)
    await db_session.commit()

    response = await client.post(
        "/api/foia",
        json={
            "agency_id": str(agency.id),
            "news_article_id": str(article.id),
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert "Officer-involved shooting" in data["request_text"]
    assert "Officer Smith" in data["request_text"]
    assert data["news_article_id"] == str(article.id)


@pytest.mark.asyncio
async def test_list_foia_requests(client: AsyncClient, db_session: AsyncSession):
    """GET /api/foia returns paginated list with filters."""
    agency = await _seed_agency(db_session)
    for i in range(3):
        await _seed_foia(db_session, agency, case_number=f"FOIA-2026-{1000 + i:04d}")
    await db_session.commit()

    response = await client.get("/api/foia")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 3
    assert len(data["items"]) == 3
    assert data["page"] == 1

    # Test status filter
    response = await client.get("/api/foia?status=submitted")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 0


@pytest.mark.asyncio
async def test_get_foia_detail(client: AsyncClient, db_session: AsyncSession):
    """GET /api/foia/{id} returns full request detail."""
    agency = await _seed_agency(db_session)
    foia = await _seed_foia(db_session, agency)
    await db_session.commit()

    response = await client.get(f"/api/foia/{foia.id}")
    assert response.status_code == 200
    data = response.json()
    assert data["case_number"] == foia.case_number
    assert data["agency_name"] == "Tampa Police Department"


@pytest.mark.asyncio
async def test_update_foia_request(client: AsyncClient, db_session: AsyncSession):
    """PATCH /api/foia/{id} updates mutable fields."""
    agency = await _seed_agency(db_session)
    foia = await _seed_foia(db_session, agency)
    await db_session.commit()

    response = await client.patch(
        f"/api/foia/{foia.id}",
        json={"notes": "Updated notes", "priority": "high"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["notes"] == "Updated notes"
    assert data["priority"] == "high"


@pytest.mark.asyncio
async def test_submit_foia_request(client: AsyncClient, db_session: AsyncSession):
    """POST /api/foia/{id}/submit sends email and updates status."""
    agency = await _seed_agency(db_session)
    foia = await _seed_foia(db_session, agency)
    await db_session.commit()

    with patch("app.api.foia.send_foia_email", new_callable=AsyncMock) as mock_send:
        mock_send.return_value = {"success": True, "message": "Sent"}
        # Also mock S3 to avoid real upload
        with patch("app.services.storage.upload_file") as mock_upload:
            mock_upload.return_value = None
            response = await client.post(f"/api/foia/{foia.id}/submit")

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["foia"]["status"] == "submitted"
    assert data["foia"]["submitted_at"] is not None
    assert data["foia"]["due_date"] is not None
    mock_send.assert_called_once()


@pytest.mark.asyncio
async def test_submit_rejects_non_draft(client: AsyncClient, db_session: AsyncSession):
    """Submit returns 400 if request is already submitted."""
    agency = await _seed_agency(db_session)
    foia = await _seed_foia(db_session, agency, status=FoiaStatus.submitted)
    await db_session.commit()

    response = await client.post(f"/api/foia/{foia.id}/submit")
    assert response.status_code == 400
    assert "Cannot submit" in response.json()["detail"]


@pytest.mark.asyncio
async def test_submit_rejects_no_agency_email(client: AsyncClient, db_session: AsyncSession):
    """Submit returns 400 if agency has no foia_email."""
    agency = await _seed_agency(db_session, foia_email=None)
    foia = await _seed_foia(db_session, agency)
    await db_session.commit()

    response = await client.post(f"/api/foia/{foia.id}/submit")
    assert response.status_code == 400
    assert "email" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_generate_pdf(client: AsyncClient, db_session: AsyncSession):
    """POST /api/foia/{id}/generate-pdf returns valid PDF bytes."""
    agency = await _seed_agency(db_session)
    foia = await _seed_foia(db_session, agency)
    await db_session.commit()

    response = await client.post(f"/api/foia/{foia.id}/generate-pdf")
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.content[:5] == b"%PDF-"


@pytest.mark.asyncio
async def test_status_summary(client: AsyncClient, db_session: AsyncSession):
    """GET /api/foia/status-summary returns counts keyed by status."""
    agency = await _seed_agency(db_session)
    await _seed_foia(db_session, agency, case_number="FOIA-2026-0001")
    await _seed_foia(db_session, agency, case_number="FOIA-2026-0002", status=FoiaStatus.submitted)
    await db_session.commit()

    response = await client.get("/api/foia/status-summary")
    assert response.status_code == 200
    counts = response.json()["counts"]
    assert counts["draft"] == 1
    assert counts["submitted"] == 1


@pytest.mark.asyncio
async def test_deadlines(client: AsyncClient, db_session: AsyncSession):
    """GET /api/foia/deadlines returns requests with due dates."""
    agency = await _seed_agency(db_session)
    due = datetime.now(timezone.utc) + timedelta(days=10)
    await _seed_foia(
        db_session,
        agency,
        status=FoiaStatus.submitted,
        due_date=due,
    )
    await db_session.commit()

    response = await client.get("/api/foia/deadlines")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["days_remaining"] >= 9  # Allow for slight timing variation


@pytest.mark.asyncio
async def test_create_duplicate_agency_article_returns_409(
    client: AsyncClient, db_session: AsyncSession
):
    """Creating a second FOIA for the same agency+article returns 409."""
    agency = await _seed_agency(db_session)
    article = await _seed_article(db_session)
    await _seed_foia(db_session, agency, news_article_id=article.id)
    await db_session.commit()

    response = await client.post(
        "/api/foia",
        json={
            "agency_id": str(agency.id),
            "news_article_id": str(article.id),
        },
    )
    assert response.status_code == 409
    assert "already exists" in response.json()["detail"]
