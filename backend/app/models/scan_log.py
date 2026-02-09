"""ScanLog model – audit trail for RSS / scrape / IMAP scan runs."""

from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class ScanType(str, enum.Enum):
    rss = "rss"
    scrape = "scrape"
    imap = "imap"


class ScanStatus(str, enum.Enum):
    running = "running"
    completed = "completed"
    failed = "failed"


class ScanLog(Base):
    __tablename__ = "scan_logs"

    scan_type: Mapped[ScanType] = mapped_column(
        Enum(ScanType, name="scan_type_enum"), nullable=False
    )
    status: Mapped[ScanStatus] = mapped_column(
        Enum(ScanStatus, name="scan_status_enum"), nullable=False
    )
    source: Mapped[str | None] = mapped_column(String(200), nullable=True)
    articles_found: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    articles_new: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    articles_duplicate: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    duration_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)

    def __repr__(self) -> str:
        return f"<ScanLog {self.scan_type.value} {self.status.value}>"
