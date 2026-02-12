"""Integration tests for Agency API endpoints."""

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agency import Agency


# ── Helpers ──────────────────────────────────────────────────────────────


async def _seed_agency(db: AsyncSession, **overrides) -> Agency:
    defaults = {
        "name": f"Test Agency {uuid.uuid4().hex[:6]}",
        "abbreviation": "TA",
        "foia_email": "records@testagency.example.com",
        "state": "FL",
    }
    defaults.update(overrides)
    agency = Agency(**defaults)
    db.add(agency)
    await db.flush()
    return agency


# ── Tests ────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_list_agencies(client: AsyncClient, db_session: AsyncSession):
    """GET /api/agencies returns all agencies."""
    await _seed_agency(db_session, name="Tampa Police Department")
    await _seed_agency(db_session, name="Hillsborough County Sheriff")
    await db_session.commit()

    response = await client.get("/api/agencies")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 2
    names = [a["name"] for a in data["items"]]
    assert "Tampa Police Department" in names
    assert "Hillsborough County Sheriff" in names


@pytest.mark.asyncio
async def test_list_agencies_search(client: AsyncClient, db_session: AsyncSession):
    """GET /api/agencies?search= filters by name."""
    await _seed_agency(db_session, name="Tampa Police Department")
    await _seed_agency(db_session, name="Hillsborough County Sheriff")
    await db_session.commit()

    response = await client.get("/api/agencies?search=Tampa")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["name"] == "Tampa Police Department"


@pytest.mark.asyncio
async def test_create_agency(client: AsyncClient, db_session: AsyncSession):
    """POST /api/agencies creates an agency."""
    response = await client.post(
        "/api/agencies",
        json={
            "name": "New Agency",
            "abbreviation": "NA",
            "foia_email": "foia@newagency.example.com",
            "state": "FL",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "New Agency"
    assert data["abbreviation"] == "NA"
    assert data["foia_email"] == "foia@newagency.example.com"
    assert data["is_active"] is True


@pytest.mark.asyncio
async def test_create_agency_name_required(client: AsyncClient):
    """POST /api/agencies rejects missing name."""
    response = await client.post("/api/agencies", json={"state": "FL"})
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_get_agency(client: AsyncClient, db_session: AsyncSession):
    """GET /api/agencies/{id} returns a single agency."""
    agency = await _seed_agency(db_session, name="Tampa PD")
    await db_session.commit()

    response = await client.get(f"/api/agencies/{agency.id}")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Tampa PD"
    assert data["id"] == str(agency.id)


@pytest.mark.asyncio
async def test_get_agency_not_found(client: AsyncClient):
    """GET /api/agencies/{id} returns 404 for unknown ID."""
    fake_id = uuid.uuid4()
    response = await client.get(f"/api/agencies/{fake_id}")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_agency(client: AsyncClient, db_session: AsyncSession):
    """PUT /api/agencies/{id} updates fields."""
    agency = await _seed_agency(db_session, name="Old Name")
    await db_session.commit()

    response = await client.put(
        f"/api/agencies/{agency.id}",
        json={"name": "New Name", "is_active": False},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "New Name"
    assert data["is_active"] is False


@pytest.mark.asyncio
async def test_delete_agency(client: AsyncClient, db_session: AsyncSession):
    """DELETE /api/agencies/{id} removes the agency."""
    agency = await _seed_agency(db_session, name="To Delete")
    await db_session.commit()

    response = await client.delete(f"/api/agencies/{agency.id}")
    assert response.status_code == 204

    # Verify it's gone
    response = await client.get(f"/api/agencies/{agency.id}")
    assert response.status_code == 404
