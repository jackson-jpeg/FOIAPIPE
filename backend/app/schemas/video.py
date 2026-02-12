"""Pydantic schemas for video endpoints."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.video import VideoStatus


# ── Create / Update ──────────────────────────────────────────────────────


class VideoCreate(BaseModel):
    foia_request_id: uuid.UUID | None = None
    title: str | None = None
    description: str | None = None


class VideoUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    tags: list[str] | None = None
    foia_request_id: uuid.UUID | None = None
    status: VideoStatus | None = None
    editing_notes: str | None = None
    priority: int | None = None
    visibility: str | None = None
    scheduled_at: datetime | None = None


# ── Responses ─────────────────────────────────────────────────────────────


class VideoResponse(BaseModel):
    id: uuid.UUID
    title: str | None = None
    description: str | None = None
    tags: list[str] | None = None
    foia_request_id: uuid.UUID | None = None
    foia_case_number: str | None = None
    status: VideoStatus
    raw_storage_key: str | None = None
    processed_storage_key: str | None = None
    thumbnail_storage_key: str | None = None
    duration_seconds: int | None = None
    resolution: str | None = None
    file_size_bytes: int | None = None
    youtube_video_id: str | None = None
    youtube_url: str | None = None
    youtube_upload_status: str | None = None
    visibility: str
    editing_notes: str | None = None
    priority: int
    published_at: datetime | None = None
    scheduled_at: datetime | None = None
    created_at: datetime
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class VideoList(BaseModel):
    items: list[VideoResponse]
    total: int
    page: int
    page_size: int


class VideoPipelineCounts(BaseModel):
    counts: dict[str, int]
