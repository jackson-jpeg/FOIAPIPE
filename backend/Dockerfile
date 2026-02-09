FROM python:3.12-slim

WORKDIR /app

# Install system dependencies for reportlab, Pillow, and psycopg
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev libjpeg62-turbo-dev zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .

ENV PYTHONPATH=/app

RUN chmod +x start.sh

# Smart startup script that detects service type from RAILWAY_SERVICE_NAME
CMD ["./start.sh"]
