"""SQLAlchemy declarative base with UUID and timestamp mixins."""

from __future__ import annotations

import uuid as _uuid
from datetime import datetime

from uuid_extensions import uuid7
from sqlalchemy import DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class UUIDMixin:
    """Provides a UUID v7 primary key."""

    id: Mapped[_uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid7,
    )


class TimestampMixin:
    """Provides created_at and updated_at timestamp columns."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        onupdate=func.now(),
        nullable=True,
    )


class Base(DeclarativeBase, UUIDMixin, TimestampMixin):
    """Base class for all ORM models.

    Includes a UUID v7 primary key plus created_at / updated_at timestamps.
    """

    __abstract__ = True
