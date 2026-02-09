"""VideoStatusChange model – audit trail for video status transitions."""

from __future__ import annotations

import uuid as _uuid
from typing import TYPE_CHECKING, Any

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.video import Video


class VideoStatusChange(Base):
    """Audit trail for video status changes."""

    __tablename__ = "video_status_changes"

    video_id: Mapped[_uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("videos.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    from_status: Mapped[str] = mapped_column(String(50), nullable=False)
    to_status: Mapped[str] = mapped_column(String(50), nullable=False)
    changed_by: Mapped[str] = mapped_column(
        String(100), nullable=False
    )  # "admin", "system", "youtube_upload"
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata: Mapped[Any | None] = mapped_column(
        JSON, nullable=True
    )  # Store upload responses, errors, etc.

    # ── Relationships ─────────────────────────────────────────────────────
    video: Mapped[Video] = relationship(
        "Video",
        back_populates="status_changes",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<VideoStatusChange {self.from_status} → {self.to_status} by {self.changed_by}>"
