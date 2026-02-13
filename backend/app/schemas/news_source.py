"""Pydantic schemas for news source endpoints."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class NewsSourceCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    url: str = Field(..., min_length=1)
    source_type: str = Field("rss", description="rss or web_scrape")
    selectors: dict | None = Field(None, description="CSS selectors for web scraping (JSONB)")
    scan_interval_minutes: int = Field(30, ge=5, le=1440)
    is_active: bool = True


class NewsSourceUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    url: str | None = Field(None, min_length=1)
    source_type: str | None = None
    selectors: dict | None = None
    scan_interval_minutes: int | None = Field(None, ge=5, le=1440)
    is_active: bool | None = None


class NewsSourceResponse(BaseModel):
    id: uuid.UUID
    name: str
    url: str
    source_type: str
    selectors: dict | None = None
    scan_interval_minutes: int
    is_active: bool
    last_scanned_at: datetime | None = None
    error_count: int
    last_error: str | None = None
    created_at: datetime
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class NewsSourceList(BaseModel):
    items: list[NewsSourceResponse]
    total: int
