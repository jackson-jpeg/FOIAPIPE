#!/bin/sh
set -e

# Run migrations
alembic -c alembic/alembic.ini upgrade head

# Detect service type from Railway service name
if [ "$RAILWAY_SERVICE_NAME" = "celery-worker" ]; then
    echo "Starting Celery Worker..."
    celery -A app.tasks.celery_app worker --loglevel=info
elif [ "$RAILWAY_SERVICE_NAME" = "celery-beat" ]; then
    echo "Starting Celery Beat..."
    celery -A app.tasks.celery_app beat --loglevel=info
else
    echo "Starting API Server..."
    uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
fi
