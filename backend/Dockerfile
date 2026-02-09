FROM python:3.12-slim

WORKDIR /app

# Install system dependencies for reportlab, Pillow, and psycopg
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev libjpeg62-turbo-dev zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .
RUN ls -la /app/ && ls -la /app/app/ && ls -la /app/alembic/

ENV PYTHONPATH=/app

# Run migrations then start the server
CMD ["sh", "-c", "ls -la /app/app/ && alembic -c alembic/alembic.ini upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
