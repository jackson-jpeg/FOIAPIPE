"""News sources router — CRUD for RSS feeds and web scrape sources."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.news_source import NewsSource, SourceType
from app.schemas.news_source import (
    NewsSourceCreate,
    NewsSourceList,
    NewsSourceResponse,
    NewsSourceUpdate,
)

router = APIRouter(prefix="/api/news-sources", tags=["news-sources"])


@router.get("", response_model=NewsSourceList)
async def list_news_sources(
    search: str | None = Query(None, description="Filter by name or URL"),
    source_type: str | None = Query(None, description="Filter by type: rss or web_scrape"),
    is_active: bool | None = Query(None, description="Filter by active status"),
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> NewsSourceList:
    """Return all configured news sources."""
    stmt = select(NewsSource).order_by(NewsSource.name)

    if search:
        pattern = f"%{search}%"
        stmt = stmt.where(NewsSource.name.ilike(pattern) | NewsSource.url.ilike(pattern))

    if source_type:
        stmt = stmt.where(NewsSource.source_type == source_type)

    if is_active is not None:
        stmt = stmt.where(NewsSource.is_active == is_active)

    result = await db.execute(stmt)
    sources = result.scalars().all()

    count_stmt = select(func.count(NewsSource.id))
    if search:
        pattern = f"%{search}%"
        count_stmt = count_stmt.where(
            NewsSource.name.ilike(pattern) | NewsSource.url.ilike(pattern)
        )
    if source_type:
        count_stmt = count_stmt.where(NewsSource.source_type == source_type)
    if is_active is not None:
        count_stmt = count_stmt.where(NewsSource.is_active == is_active)

    total = (await db.execute(count_stmt)).scalar_one()

    return NewsSourceList(
        items=[NewsSourceResponse.model_validate(s) for s in sources],
        total=total,
    )


@router.get("/{source_id}", response_model=NewsSourceResponse)
async def get_news_source(
    source_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> NewsSourceResponse:
    """Return a single news source by ID."""
    source = await db.get(NewsSource, source_id)
    if not source:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="News source not found"
        )
    return NewsSourceResponse.model_validate(source)


@router.post("", response_model=NewsSourceResponse, status_code=status.HTTP_201_CREATED)
async def create_news_source(
    body: NewsSourceCreate,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> NewsSourceResponse:
    """Create a new news source."""
    source = NewsSource(
        name=body.name,
        url=body.url,
        source_type=SourceType(body.source_type),
        selectors=body.selectors,
        scan_interval_minutes=body.scan_interval_minutes,
        is_active=body.is_active,
    )
    db.add(source)
    await db.flush()
    await db.refresh(source)
    return NewsSourceResponse.model_validate(source)


@router.put("/{source_id}", response_model=NewsSourceResponse)
async def update_news_source(
    source_id: uuid.UUID,
    body: NewsSourceUpdate,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> NewsSourceResponse:
    """Update an existing news source."""
    source = await db.get(NewsSource, source_id)
    if not source:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="News source not found"
        )
    update_data = body.model_dump(exclude_unset=True)
    if "source_type" in update_data and update_data["source_type"] is not None:
        update_data["source_type"] = SourceType(update_data["source_type"])
    for field, value in update_data.items():
        setattr(source, field, value)
    await db.flush()
    await db.refresh(source)
    return NewsSourceResponse.model_validate(source)


@router.delete("/{source_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_news_source(
    source_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> None:
    """Delete a news source."""
    source = await db.get(NewsSource, source_id)
    if not source:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="News source not found"
        )
    await db.delete(source)
    await db.flush()
