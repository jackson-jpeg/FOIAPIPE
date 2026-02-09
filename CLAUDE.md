# CLAUDE.md — FOIAPIPE Project Conventions

## Project Overview

FOIAPIPE is a FOIA (Freedom of Information Act) request pipeline and video publishing platform focused on Tampa Bay law enforcement accountability. It automates news scanning, FOIA request generation, and bodycam video processing for YouTube.

## Architecture

- **Backend:** Python 3.12+ / FastAPI / SQLAlchemy (async) / Celery / PostgreSQL 16 / Redis 7
- **Frontend:** React 18 / TypeScript / Vite / Tailwind CSS / Zustand
- **Deployment:** Railway (Dockerized)
- **Email:** iCloud custom domain via `recordsrequest@foiaarchive.com`

## Directory Layout

```
backend/
  app/
    api/          # FastAPI routers (prefixed /api/*)
    models/       # SQLAlchemy ORM models (UUID v7 PKs, timestamps)
    schemas/      # Pydantic request/response schemas
    services/     # Business logic (scanner, classifier, email, etc.)
    tasks/        # Celery background tasks
    config.py     # Pydantic Settings from .env
    database.py   # Async engine + session factory
    main.py       # FastAPI entrypoint
    seed.py       # Agency seed script
  alembic/        # Database migrations
  tests/          # pytest + pytest-asyncio
  seed/           # JSON seed data
frontend/
  src/
    api/          # Axios API client modules
    components/   # Reusable UI components
    pages/        # Page-level components
    stores/       # Zustand state stores
    hooks/        # Custom React hooks
    lib/          # Utilities (cn, formatters, constants)
```

## Key Commands

```bash
# Backend
cd backend && source venv/bin/activate
uvicorn app.main:app --reload                    # Start dev server
alembic -c alembic/alembic.ini upgrade head      # Run migrations
python -m app.seed                               # Seed agencies
pytest tests/ -v                                 # Run tests
celery -A app.tasks.celery_app worker --loglevel=info  # Start worker

# Frontend
cd frontend && npm run dev                       # Start dev server (port 3000)
npm run build                                    # Production build

# Infrastructure
docker-compose up -d                             # Start Postgres + Redis
```

## Conventions

- **Models:** All use UUID v7 primary keys via `Base` (from `models/base.py`). Include `created_at` / `updated_at` timestamps.
- **API routes:** All prefixed with `/api/`. Auth required on all routes except `/api/health` and `/api/auth/login`.
- **Auth:** Single admin user, JWT-based. Username: `admin`, password from `ADMIN_PASSWORD` env var.
- **Enums:** Defined in model files, shared via `models/__init__.py`.
- **DB sessions:** Use `get_db` dependency in routers. In Celery tasks, use `async_session_factory()` context manager.
- **Tests:** Use `conftest.py` fixtures (`client`, `db_session`). Auth is auto-overridden to "admin" in tests.

## Critical Safety Rules

1. **`auto_submit_enabled` must default to `false`** — never auto-file real FOIA requests without explicit manual approval.
2. **Never commit `.env`** — it contains secrets. Only `.env.example` is tracked.
3. **FOIA requests are legally binding** — treat the submission pipeline with extreme care.
4. **No destructive git operations** without explicit approval.

## Environment Variables

Required for boot: `DATABASE_URL`, `SECRET_KEY`, `ADMIN_PASSWORD`
Required for email: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `IMAP_HOST`, `IMAP_PORT`, `IMAP_USER`, `IMAP_PASSWORD`
Optional: All other API keys (YouTube, Anthropic, Twilio, S3)
