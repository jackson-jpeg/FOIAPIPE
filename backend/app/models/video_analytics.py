"""VideoAnalytics model – daily YouTube metrics per video."""

from __future__ import annotations

import uuid as _uuid
from datetime import date
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    Date,
    Float,
    ForeignKey,
    Integer,
    Numeric,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.video import Video


class VideoAnalytics(Base):
    __tablename__ = "video_analytics"
    __table_args__ = (
        UniqueConstraint("video_id", "date", name="uq_video_analytics_video_date"),
    )

    video_id: Mapped[_uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("videos.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    views: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    watch_time_minutes: Mapped[float] = mapped_column(
        Float, default=0.0, nullable=False
    )
    estimated_revenue: Mapped[Decimal] = mapped_column(
        Numeric(10, 4), default=0, nullable=False
    )
    impressions: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    ctr: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    subscribers_gained: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False
    )
    subscribers_lost: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    likes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    dislikes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    comments: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    shares: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # ── Relationships ─────────────────────────────────────────────────────
    video: Mapped[Video] = relationship(
        "Video",
        back_populates="analytics",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<VideoAnalytics video={self.video_id} date={self.date}>"
