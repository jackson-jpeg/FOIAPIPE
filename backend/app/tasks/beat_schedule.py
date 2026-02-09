"""Celery Beat schedule definition for periodic tasks."""

from celery.schedules import crontab

CELERY_BEAT_SCHEDULE = {
    "scan-news-rss": {
        "task": "app.tasks.news_tasks.scan_news_rss",
        "schedule": 1800.0,  # Every 30 minutes
        "options": {"queue": "default"},
    },
    "scan-news-scrape": {
        "task": "app.tasks.news_tasks.scan_news_scrape",
        "schedule": 7200.0,  # Every 2 hours
        "options": {"queue": "default"},
    },
    "check-foia-inbox": {
        "task": "app.tasks.foia_tasks.check_foia_inbox",
        "schedule": 900.0,  # Every 15 minutes
        "options": {"queue": "default"},
    },
    "check-foia-deadlines": {
        "task": "app.tasks.foia_tasks.check_foia_deadlines",
        "schedule": crontab(hour=8, minute=0),  # Daily 8 AM EST
        "options": {"queue": "default"},
    },
    "poll-youtube-analytics": {
        "task": "app.tasks.youtube_tasks.poll_youtube_analytics",
        "schedule": crontab(hour=6, minute=0),  # Daily 6 AM EST
        "options": {"queue": "default"},
    },
    "generate-daily-summary": {
        "task": "app.tasks.notification_tasks.generate_daily_summary",
        "schedule": crontab(hour=9, minute=0),  # Daily 9 AM EST
        "options": {"queue": "default"},
    },
    "cleanup-old-scanlogs": {
        "task": "app.tasks.maintenance_tasks.cleanup_old_scanlogs",
        "schedule": crontab(hour=2, minute=0, day_of_week="sunday"),  # Weekly Sunday 2 AM
        "options": {"queue": "default"},
    },
}
