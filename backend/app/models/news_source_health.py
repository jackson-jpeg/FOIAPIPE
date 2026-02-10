"""NewsSourceHealth model - tracks reliability and circuit breaker state for news sources."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class NewsSourceHealth(Base):
    """Tracks health and circuit breaker state for each news source."""

    __tablename__ = "news_source_health"

    source_name: Mapped[str] = mapped_column(
        String(200), unique=True, nullable=False, index=True
    )
    source_url: Mapped[str] = mapped_column(String(1000), nullable=False)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_circuit_open: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )  # True = circuit open (disabled due to failures)

    consecutive_failures: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_failures: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_successes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    last_success_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_failure_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    circuit_opened_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )  # When circuit was opened
    circuit_retry_after: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )  # When to retry (6 hours after circuit opened)

    last_error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    def __repr__(self) -> str:
        status = "CIRCUIT_OPEN" if self.is_circuit_open else "ENABLED" if self.is_enabled else "DISABLED"
        return f"<NewsSourceHealth {self.source_name} [{status}] failures={self.consecutive_failures}>"
