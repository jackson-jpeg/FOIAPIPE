"""TaskRun model — records Celery task execution history for monitoring."""

from __future__ import annotations

import enum

from sqlalchemy import DateTime, Enum, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class TaskRunStatus(str, enum.Enum):
    success = "success"
    failure = "failure"
    timeout = "timeout"
    started = "started"


class TaskRun(Base):
    __tablename__ = "task_runs"

    task_name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    celery_task_id: Mapped[str | None] = mapped_column(String(200), nullable=True)
    started_at: Mapped[str] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_at: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[TaskRunStatus] = mapped_column(
        Enum(TaskRunStatus, name="task_run_status"), nullable=False, default=TaskRunStatus.started
    )
    result_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
