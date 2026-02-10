"""Video subtitle model – track generated subtitles for videos."""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.video import Video


class VideoSubtitle(Base):
    """Subtitle track for a video.

    Supports multiple subtitle files per video (different languages, formats).
    """

    __tablename__ = "video_subtitles"

    video_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True), ForeignKey("videos.id", ondelete="CASCADE"), nullable=False
    )
    language: Mapped[str] = mapped_column(String(10), nullable=False)  # ISO 639-1 code
    format: Mapped[str] = mapped_column(String(10), nullable=False)  # srt, vtt, ass
    storage_key: Mapped[str | None] = mapped_column(String(500), nullable=True)
    youtube_caption_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    provider: Mapped[str | None] = mapped_column(String(50), nullable=True)  # whisper, google, etc.
    segment_count: Mapped[int | None] = mapped_column(nullable=True)
    file_size_bytes: Mapped[int | None] = mapped_column(nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── Relationships ─────────────────────────────────────────────────────
    video: Mapped[Video] = relationship("Video", back_populates="subtitles")

    def __repr__(self) -> str:
        return f"<VideoSubtitle {self.language}/{self.format} for video {self.video_id}>"
