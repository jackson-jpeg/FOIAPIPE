#!/bin/sh
set -e

echo "RAILWAY_SERVICE_NAME: $RAILWAY_SERVICE_NAME"

# Run migrations
alembic -c alembic/alembic.ini upgrade head

# Detect service type from Railway service name
case "$RAILWAY_SERVICE_NAME" in
    celery-worker)
        echo "Starting Celery Worker..."
        exec celery -A app.tasks.celery_app worker --loglevel=info
        ;;
    celery-beat)
        echo "Starting Celery Beat..."
        exec celery -A app.tasks.celery_app beat --loglevel=info
        ;;
    *)
        echo "Starting API Server..."
        exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
        ;;
esac
