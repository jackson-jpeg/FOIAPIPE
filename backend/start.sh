#!/bin/bash
# Force rebuild to pick up railway.toml changes (no healthcheck for celery services)

echo "=== FOIAPIPE START SCRIPT ==="
echo "RAILWAY_SERVICE_NAME: $RAILWAY_SERVICE_NAME"
echo "PORT: $PORT"
echo "DATABASE_URL: ${DATABASE_URL:0:50}..."
echo "REDIS_URL: ${REDIS_URL:0:40}..."

# Run migrations
echo "Running database migrations..."
if alembic -c alembic/alembic.ini upgrade head; then
    echo "Migrations completed successfully"
else
    echo "ERROR: Migrations failed with exit code $?"
    echo "Continuing anyway to allow debugging..."
fi

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
