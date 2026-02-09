"""AppSetting model – key-value application settings stored in the database.

NOTE: This model uses `key` as its primary key instead of the UUID mixin.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from app.models.base import TimestampMixin


class _AppSettingBase(DeclarativeBase):
    """Separate declarative base so we can skip UUIDMixin."""

    pass


class AppSetting(_AppSettingBase, TimestampMixin):
    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(
        String(100), primary_key=True, unique=True, nullable=False
    )
    value: Mapped[str | None] = mapped_column(Text, nullable=True)
    value_type: Mapped[str] = mapped_column(
        String(20), default="string", nullable=False
    )
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)

    def __repr__(self) -> str:
        return f"<AppSetting {self.key}={self.value}>"
