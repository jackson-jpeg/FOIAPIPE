"""NewsSource model — database-driven feed/scrape source configuration."""

from __future__ import annotations

import enum

from sqlalchemy import Boolean, DateTime, Enum, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class SourceType(str, enum.Enum):
    rss = "rss"
    web_scrape = "web_scrape"


class NewsSource(Base):
    __tablename__ = "news_sources"

    name: Mapped[str] = mapped_column(String(200), nullable=False, unique=True)
    url: Mapped[str] = mapped_column(Text, nullable=False)
    source_type: Mapped[SourceType] = mapped_column(
        Enum(SourceType, name="source_type"), nullable=False, default=SourceType.rss
    )
    selectors: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    scan_interval_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    last_scanned_at: Mapped[str | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    error_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
