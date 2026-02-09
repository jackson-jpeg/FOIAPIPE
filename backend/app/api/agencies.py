"""Agencies router – full CRUD for law enforcement agencies."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.agency import Agency
from app.schemas.agency import AgencyCreate, AgencyList, AgencyResponse, AgencyUpdate

router = APIRouter(prefix="/api/agencies", tags=["agencies"])


@router.get("", response_model=AgencyList)
async def list_agencies(
    search: str | None = Query(None, description="Filter by name or abbreviation"),
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> AgencyList:
    """Return all agencies, with optional search filter."""
    stmt = select(Agency).order_by(Agency.name)

    if search:
        pattern = f"%{search}%"
        stmt = stmt.where(
            Agency.name.ilike(pattern) | Agency.abbreviation.ilike(pattern)
        )

    result = await db.execute(stmt)
    agencies = result.scalars().all()

    count_stmt = select(func.count(Agency.id))
    if search:
        pattern = f"%{search}%"
        count_stmt = count_stmt.where(
            Agency.name.ilike(pattern) | Agency.abbreviation.ilike(pattern)
        )
    total = (await db.execute(count_stmt)).scalar_one()

    return AgencyList(
        items=[AgencyResponse.model_validate(a) for a in agencies],
        total=total,
    )


@router.get("/{agency_id}", response_model=AgencyResponse)
async def get_agency(
    agency_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> AgencyResponse:
    """Return a single agency by ID."""
    agency = await db.get(Agency, agency_id)
    if not agency:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Agency not found"
        )
    return AgencyResponse.model_validate(agency)


@router.post("", response_model=AgencyResponse, status_code=status.HTTP_201_CREATED)
async def create_agency(
    body: AgencyCreate,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> AgencyResponse:
    """Create a new agency."""
    agency = Agency(**body.model_dump())
    db.add(agency)
    await db.flush()
    await db.refresh(agency)
    return AgencyResponse.model_validate(agency)


@router.put("/{agency_id}", response_model=AgencyResponse)
async def update_agency(
    agency_id: uuid.UUID,
    body: AgencyUpdate,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> AgencyResponse:
    """Update an existing agency."""
    agency = await db.get(Agency, agency_id)
    if not agency:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Agency not found"
        )
    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(agency, field, value)
    await db.flush()
    await db.refresh(agency)
    return AgencyResponse.model_validate(agency)


@router.delete("/{agency_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_agency(
    agency_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> None:
    """Delete an agency by ID."""
    agency = await db.get(Agency, agency_id)
    if not agency:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Agency not found"
        )
    await db.delete(agency)
    await db.flush()
