# FOIAPIPE

Automated FOIA request pipeline for Tampa Bay law enforcement accountability. Scans local news, classifies incidents, generates public records requests, and manages bodycam video publishing.

## Quick Start

### Prerequisites

- Python 3.12+
- Node.js 20+
- Docker (for Postgres + Redis)

### 1. Start infrastructure

```bash
docker-compose up -d
```

### 2. Backend setup

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Run migrations
alembic -c alembic/alembic.ini upgrade head

# Seed agencies
python -m app.seed

# Start server
uvicorn app.main:app --reload
```

### 3. Frontend setup

```bash
cd frontend
npm install
npm run dev
```

### 4. Open the app

Navigate to `http://localhost:3000` and login with:
- Username: `admin`
- Password: (value of `ADMIN_PASSWORD` in `.env`)

## Architecture

```
News Sources (RSS) → Scanner → Classifier → Articles DB
                                                ↓
                                    FOIA Generator → Email → Agency
                                                ↓
                                    Video Pipeline → YouTube
                                                ↓
                                        Analytics Dashboard
```

| Component | Technology |
|-----------|-----------|
| Backend | FastAPI + SQLAlchemy (async) + Celery |
| Frontend | React + TypeScript + Tailwind + Zustand |
| Database | PostgreSQL 16 |
| Cache/Queue | Redis 7 |
| Deployment | Railway |

## Project Structure

```
backend/app/
  api/        → FastAPI route handlers
  models/     → SQLAlchemy ORM models
  schemas/    → Pydantic schemas
  services/   → Business logic
  tasks/      → Celery background tasks
frontend/src/
  pages/      → Page components
  components/ → Reusable UI
  stores/     → Zustand state
  api/        → API client
```

## Environment Variables

Copy `.env.example` to `.env` and fill in required values. See `CLAUDE.md` for details.
