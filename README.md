# FOIA Archive

> **FOIA request pipeline and video publishing platform for law enforcement accountability**

[![Production Ready](https://img.shields.io/badge/production-ready-brightgreen)](https://github.com/jackson-jpeg/FOIAPIPE)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Railway: foiaarchive-backend](https://img.shields.io/badge/Railway-foiaarchive--backend-blueviolet)](https://railway.app)

FOIA Archive automates the discovery, FOIA requesting, editing, publishing, and monetization tracking of police bodycam footage sourced from local Tampa Bay news incidents.

---

## 🎯 What It Does

1. **DISCOVER** — Automatically scan Tampa Bay news for police incidents
2. **REQUEST** — Auto-generate and submit FOIA/public records requests
3. **TRACK** — Monitor FOIA status from submission through fulfillment
4. **PROCESS** — Manage video editing pipeline with AI assistance
5. **PUBLISH** — Upload finished videos to YouTube with optimized metadata
6. **MONETIZE** — Track analytics, revenue, and ROI

---

## 🚀 Quick Start

### Prerequisites

- Python 3.12+
- Node.js 18+
- PostgreSQL 16
- Redis 7
- Docker & Docker Compose (optional)

### Local Development

\`\`\`bash
# 1. Clone and start infrastructure
git clone https://github.com/jackson-jpeg/FOIAPIPE.git
cd FOIAPIPE
docker-compose up -d  # PostgreSQL + Redis

# 2. Backend setup
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # Edit with your credentials

# 3. Database setup
alembic -c alembic/alembic.ini upgrade head
python -m app.seed

# 4. Start services (3 terminals)
uvicorn app.main:app --reload --port 8000
celery -A app.tasks.celery_app worker --loglevel=info
celery -A app.tasks.celery_app beat --loglevel=info

# 5. Frontend setup
cd frontend
npm install
npm run dev  # Visit http://localhost:5173
\`\`\`

**Default Login:** Username: \`admin\`, Password: from \`ADMIN_PASSWORD\` env var

---

## 🏗️ Architecture

**Backend:** Python 3.12 / FastAPI / SQLAlchemy (async) / Celery / PostgreSQL / Redis
**Frontend:** React 18 / TypeScript / Vite / Tailwind / Zustand
**Deployment:** Railway (foiaarchive-backend) / Cloudflare R2

---

## 📦 Project Structure

\`\`\`
backend/
  app/api/          # 14 FastAPI routers
  app/models/       # SQLAlchemy ORM
  app/services/     # 17 services (4,387 lines)
  app/tasks/        # Celery background jobs
  tests/            # pytest (343 lines)

frontend/
  src/components/   # 40 React components
  src/pages/        # 8 pages
  src/types/        # TypeScript types
  src/test/         # Vitest setup
\`\`\`

---

## 🔑 Features

- **Automated News Scanning** — AI classification via Claude
- **FOIA Automation** — FL Chapter 119 compliant
- **Video Pipeline** — AI editing + YouTube upload
- **Revenue Tracking** — Analytics + ROI analysis
- **Security** — Rate limiting, Sentry, audit logs

---

## 🧪 Testing

\`\`\`bash
# Backend
cd backend && pytest tests/ -v

# Frontend
cd frontend && npm test
npm run test:ui
npm run test:coverage
\`\`\`

---

## 🚢 Deployment

Deploy to Railway (\`foiaarchive-backend\` project):

\`\`\`bash
railway login
railway link
railway up
\`\`\`

See [DEPLOYMENT.md](DEPLOYMENT.md) for complete guide.

---

## 📈 Status

**Version:** 1.0.0
**Production Ready:** 98% ✅
**Last Updated:** February 10, 2026

See [CHANGELOG.md](CHANGELOG.md) for recent improvements.

---

## 📄 Documentation

- [DEPLOYMENT.md](DEPLOYMENT.md) — Complete deployment guide
- [CLAUDE.md](CLAUDE.md) — Project conventions
- [IMPROVEMENT_ROADMAP.md](IMPROVEMENT_ROADMAP.md) — Future enhancements
- [CHANGELOG.md](CHANGELOG.md) — Version history

---

**Built for police accountability and transparency in Tampa Bay** 🎯
