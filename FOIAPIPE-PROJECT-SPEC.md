# FOIAPIPE Project Specification

**Version:** 1.0
**Created:** 2026-02-09
**Status:** Phase 2 — News Scanner Verification

---

## 1. Purpose

FOIAPIPE automates the pipeline from news discovery to public records acquisition for Tampa Bay law enforcement accountability journalism:

1. **Scan** local news for police incidents (RSS feeds + web scraping)
2. **Classify** articles by incident type and severity
3. **Generate** FOIA/public records requests targeting the correct agency
4. **Submit** requests via email (manual approval required before send)
5. **Track** request status, deadlines, and agency responses
6. **Process** received bodycam/dashcam video for publication
7. **Publish** to YouTube with AI-generated metadata
8. **Analyze** video performance and revenue

## 2. Users

Single admin operator. No multi-tenant support. Auth: JWT with `admin` / `ADMIN_PASSWORD`.

## 3. Phases

| Phase | Scope | Status |
|-------|-------|--------|
| 1 | Foundation (DB, auth, Docker, project structure) | Scaffolded |
| 2 | News Scanner (RSS scan, classify, score, UI) | **Active** |
| 3 | FOIA Engine (draft creation, PDF generation, email submission) | Scaffolded |
| 4 | Email Monitor (IMAP polling, response parsing, status updates) | Scaffolded |
| 5 | Video Pipeline (upload, process, thumbnail, YouTube publish) | Scaffolded |
| 6 | Analytics & Revenue (YouTube stats, revenue tracking, dashboard) | Scaffolded |
| 7 | Notifications & Polish (SMS/email alerts, daily summaries) | Scaffolded |

## 4. Module Specifications

### 4.1 News Scanner

**Data flow:** RSS Feed → feedparser → dedup check → DB insert → classify → score → UI

**RSS Sources:**
- Tampa Bay Times (crime feed)
- WFLA
- Fox 13 Tampa Bay
- Bay News 9
- 10 Tampa Bay (WTSP)
- Patch Tampa

**Classification (keyword-based):**
- Incident types: OIS, use of force, pursuit, taser, K9, arrest, DUI, other
- Severity: 1–10 scale based on incident type + modifiers (death, injury, bodycam mention, etc.)
- Agency detection: Pattern matching against known Tampa Bay agencies

**Dedup:** URL exact match + rapidfuzz headline similarity (threshold: 85) within 7-day window.

**Celery schedule:** RSS scan every 30 min, scrape every 2 hours.

### 4.2 FOIA Engine

**Data flow:** Article → agency lookup → case number generation → request text → PDF → draft status

**Case numbers:** `FP-YYYYMMDD-XXXX` (date + 4 random hex chars)

**Statuses:** draft → ready → submitted → acknowledged → processing → fulfilled/partial/denied → closed

**Safety:** `auto_submit_enabled` defaults to `false`. All submissions require manual trigger.

### 4.3 Email System

**Outbound (SMTP):** `smtp.mail.me.com:587` (STARTTLS)
**Inbound (IMAP):** `imap.mail.me.com:993` (SSL)
**Address:** `recordsrequest@foiaarchive.com` (iCloud custom domain via Squarespace)

### 4.4 Video Pipeline

**Flow:** Raw upload → FFmpeg metadata extraction → thumbnail generation → AI metadata (Claude) → YouTube upload

**Storage:** Cloudflare R2 (S3-compatible)

### 4.5 Analytics

**Sources:** YouTube Data API (daily poll at 6 AM EST)
**Metrics:** Views, watch time, subscribers, revenue per video, time series

## 5. Database

PostgreSQL 16 with async driver (asyncpg). 9 tables, all UUID v7 PKs.

See migration `db74a32f37a1` for complete schema.

## 6. Deployment

**Target:** Railway
**Services:** Backend (FastAPI + Celery worker), Frontend (static build served by nginx), Postgres, Redis
**Domain:** TBD

## 7. Design Principles

- Subtraction: remove UI elements that don't serve immediate intent
- Hierarchy: primary actions visually dominant
- Spacing: 4/8/16/24/32px scale
- Color: for meaning only (severity = red/amber/green, status badges)
- Motion: purposeful only (scan animation, status transitions)
