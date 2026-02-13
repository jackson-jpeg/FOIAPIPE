"""Celery application configuration."""

from celery import Celery

from app.config import settings

celery_app = Celery(
    "foiaarchive",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=[
        "app.tasks.news_tasks",
        "app.tasks.foia_tasks",
        "app.tasks.youtube_tasks",
        "app.tasks.notification_tasks",
        "app.tasks.maintenance_tasks",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="America/New_York",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_soft_time_limit=300,
    task_time_limit=600,
)

# Import beat schedule
from app.tasks.beat_schedule import CELERY_BEAT_SCHEDULE  # noqa: E402

celery_app.conf.beat_schedule = CELERY_BEAT_SCHEDULE

# Import task monitor to register Celery signals
import app.tasks.task_monitor  # noqa: F401, E402
