"""Video model – footage obtained via FOIA for editing and publishing."""

from __future__ import annotations

import enum
import uuid as _uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    BigInteger,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.foia_request import FoiaRequest
    from app.models.video_analytics import VideoAnalytics
    from app.models.video_status_change import VideoStatusChange
    from app.models.video_subtitle import VideoSubtitle


class VideoStatus(str, enum.Enum):
    raw_received = "raw_received"
    editing = "editing"
    ai_processing = "ai_processing"
    review = "review"
    ready = "ready"
    scheduled = "scheduled"
    uploading = "uploading"
    published = "published"
    archived = "archived"


class Video(Base):
    __tablename__ = "videos"

    title: Mapped[str | None] = mapped_column(String(500), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    tags: Mapped[list | None] = mapped_column(JSON, nullable=True)
    foia_request_id: Mapped[_uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("foia_requests.id", ondelete="SET NULL"),
        nullable=True,
    )
    status: Mapped[VideoStatus] = mapped_column(
        Enum(VideoStatus, name="video_status_enum"),
        default=VideoStatus.raw_received,
        nullable=False,
    )
    raw_storage_key: Mapped[str | None] = mapped_column(String(500), nullable=True)
    processed_storage_key: Mapped[str | None] = mapped_column(
        String(500), nullable=True
    )
    thumbnail_storage_key: Mapped[str | None] = mapped_column(
        String(500), nullable=True
    )
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    resolution: Mapped[str | None] = mapped_column(String(20), nullable=True)
    file_size_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    youtube_video_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    youtube_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    youtube_upload_status: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )
    visibility: Mapped[str] = mapped_column(
        String(20), default="unlisted", nullable=False
    )
    editing_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    priority: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    scheduled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )

    # ── Relationships ─────────────────────────────────────────────────────
    foia_request: Mapped[FoiaRequest | None] = relationship(
        "FoiaRequest",
        back_populates="videos",
        lazy="selectin",
    )
    analytics: Mapped[list[VideoAnalytics]] = relationship(
        "VideoAnalytics",
        back_populates="video",
        lazy="selectin",
    )
    status_changes: Mapped[list[VideoStatusChange]] = relationship(
        "VideoStatusChange",
        back_populates="video",
        lazy="selectin",
        order_by="VideoStatusChange.created_at",
    )
    subtitles: Mapped[list[VideoSubtitle]] = relationship(
        "VideoSubtitle",
        back_populates="video",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<Video {self.title or self.id}>"
