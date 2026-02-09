# FOIAPIPE Production Deployment Guide

## Overview

This guide covers deploying FOIAPIPE to production on **foiaarchive.com**.

**Architecture:**
- **Frontend**: Vercel (foiaarchive.com)
- **Backend**: Railway (API)
- **Database**: Railway PostgreSQL
- **Redis**: Railway Redis
- **Celery Worker**: Railway (separate service)

---

## Pre-Deployment Checklist

### ✅ Code Ready
- [x] All 3 phases implemented
- [x] Frontend builds successfully
- [x] Backend imports verified
- [x] 2 new migrations ready (foia_status_changes, video_status_changes)
- [x] Tests passing

### ✅ Environment Variables Documented
- [x] Required variables listed in `.env.example`
- [x] CORS origins updated for production
- [x] API keys documented

---

## Backend Deployment (Railway)

### 1. Database Migrations

The Dockerfile automatically runs migrations on startup:
```dockerfile
CMD ["sh", "-c", "alembic -c alembic/alembic.ini upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
```

**Migration Chain:**
1. `db74a32f37a1` - Initial schema (already deployed)
2. `9a8e4c2b1f3d` - Add foia_status_changes table (NEW)
3. `7f2d9b4e3c8a` - Add video_status_changes table (NEW)

### 2. Required Environment Variables

**Critical (App won't start without these):**
```bash
DATABASE_URL=postgresql+asyncpg://...  # Railway provides this
REDIS_URL=redis://...                  # Railway provides this
SECRET_KEY=<generate-random-64-char>   # For JWT signing
ADMIN_PASSWORD=<strong-password>       # Admin login
```

**Email (Required for FOIA submissions):**
```bash
SMTP_HOST=smtp.mail.me.com
SMTP_PORT=587
SMTP_USER=recordsrequest@foiaarchive.com
SMTP_PASSWORD=<icloud-app-specific-password>
FROM_EMAIL=recordsrequest@foiaarchive.com

IMAP_HOST=imap.mail.me.com
IMAP_PORT=993
IMAP_USER=recordsrequest@foiaarchive.com
IMAP_PASSWORD=<same-as-smtp>
```

**S3/Storage (Required for FOIA PDFs):**
```bash
S3_ENDPOINT=<your-r2-or-s3-endpoint>
S3_ACCESS_KEY=<access-key>
S3_SECRET_KEY=<secret-key>
S3_BUCKET_NAME=<bucket-name>
S3_REGION=us-east-1
```

**CORS (CRITICAL - Update for production):**
```bash
CORS_ORIGINS=["https://foiaarchive.com","https://www.foiaarchive.com"]
```

**Optional (Features work without these):**
```bash
# AI Classification (falls back to regex if not set)
ANTHROPIC_API_KEY=<claude-api-key>

# YouTube Analytics Sync
YOUTUBE_CLIENT_ID=<oauth-client-id>
YOUTUBE_CLIENT_SECRET=<oauth-secret>
YOUTUBE_REFRESH_TOKEN=<oauth-refresh-token>

# SMS Notifications
TWILIO_ACCOUNT_SID=<twilio-sid>
TWILIO_AUTH_TOKEN=<twilio-token>
TWILIO_FROM_NUMBER=<twilio-number>
NOTIFICATION_PHONE=<your-phone>
```

### 3. Railway Services Setup

**Service 1: API (backend)**
- Root directory: `/backend`
- Build command: (uses Dockerfile)
- Start command: (defined in Dockerfile)
- Environment variables: All from above

**Service 2: Celery Worker**
- Root directory: `/backend`
- Start command: `celery -A app.tasks.celery_app worker --loglevel=info`
- Environment variables: Same as API (shares DATABASE_URL, REDIS_URL)

**Service 3: Celery Beat (Scheduler)**
- Root directory: `/backend`
- Start command: `celery -A app.tasks.celery_app beat --loglevel=info`
- Environment variables: Same as API

### 4. Deployment Steps

1. **Update CORS in Railway:**
   ```bash
   CORS_ORIGINS=["https://foiaarchive.com"]
   ```

2. **Deploy backend:**
   - Push to main branch
   - Railway auto-deploys
   - Migrations run automatically on startup
   - Check logs for "Applied 2 migrations"

3. **Verify deployment:**
   ```bash
   curl https://your-api.railway.app/api/health
   # Should return: {"status":"ok"}
   ```

---

## Frontend Deployment (Vercel)

### 1. Environment Variables

**Vercel Environment Variables:**
```bash
VITE_API_URL=https://your-api.railway.app
```

### 2. Build Settings

- **Framework Preset**: Vite
- **Root Directory**: `frontend`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

### 3. Domain Configuration

**Primary Domain**: `foiaarchive.com`
**Alternative**: `www.foiaarchive.com`

1. Add both domains in Vercel
2. Set foiaarchive.com as primary
3. Redirect www → root (Vercel handles this)

### 4. Deployment Steps

1. **Connect Vercel to GitHub:**
   - Import project from GitHub
   - Select `jackson-jpeg/FOIAPIPE` repo
   - Root: `frontend`

2. **Configure build:**
   - Add `VITE_API_URL` environment variable
   - Deploy

3. **Verify deployment:**
   - Visit https://foiaarchive.com
   - Check browser console for errors
   - Try logging in (username: admin, password from ADMIN_PASSWORD)

---

## Post-Deployment Verification

### Backend Health Checks

```bash
# Health endpoint
curl https://your-api.railway.app/api/health
# Expected: {"status":"ok"}

# Auth check
curl -X POST https://your-api.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"YOUR_PASSWORD"}'
# Expected: {"access_token":"..."}

# Database check (requires auth)
curl https://your-api.railway.app/api/agencies \
  -H "Authorization: Bearer YOUR_TOKEN"
# Expected: JSON array of agencies
```

### Frontend Health Checks

1. Visit https://foiaarchive.com
2. Check browser console (no CORS errors)
3. Login with admin credentials
4. Navigate to each page:
   - Dashboard: stats load
   - News Scanner: articles load
   - FOIA Requests: list loads
   - Videos: list loads
   - Analytics: charts render

### Celery Tasks Verification

Check Railway logs for:
- `scan-news-rss`: Runs every 30 minutes
- `check-foia-inbox`: Runs every 15 minutes
- `poll-youtube-analytics`: Runs daily at 2 AM

---

## Migration Status

**Current Database Schema:**
```
✓ agencies
✓ news_articles
✓ foia_requests
✓ foia_status_changes (NEW - Phase 1)
✓ videos
✓ video_analytics
✓ video_status_changes (NEW - Phase 3)
✓ notifications
✓ app_settings
✓ scan_logs
✓ revenue_transactions
```

**To Verify Migrations Ran:**
```sql
-- Connect to Railway PostgreSQL
SELECT * FROM alembic_version;
-- Should show: 7f2d9b4e3c8a (latest)

-- Check new tables exist
\dt foia_status_changes
\dt video_status_changes
```

---

## Rollback Plan

**If deployment fails:**

1. **Backend rollback:**
   - Railway: Revert to previous deployment
   - Migrations auto-rollback on container restart

2. **Frontend rollback:**
   - Vercel: Revert to previous deployment (one-click)

3. **Database rollback (if needed):**
   ```bash
   # Connect to Railway shell
   alembic -c alembic/alembic.ini downgrade -1
   ```

---

## Monitoring

**Railway Logs:**
- API logs: Check for errors, 500s
- Celery worker logs: Check task execution
- Celery beat logs: Check scheduling

**Vercel Logs:**
- Build logs: Check for build errors
- Function logs: Check API calls
- Analytics: Monitor traffic

**Key Metrics:**
- API response time < 500ms
- Database queries < 100ms
- Celery tasks success rate > 95%
- Frontend load time < 2s

---

## Security Checklist

- [x] CORS limited to foiaarchive.com
- [x] SECRET_KEY is strong random string
- [x] ADMIN_PASSWORD is strong
- [x] Email passwords are app-specific (not account password)
- [x] S3/R2 credentials have minimal permissions
- [x] Database has strong password
- [x] Redis requires authentication
- [x] All API endpoints require auth (except /health, /login)

---

## Cost Estimates

**Railway (Backend + Workers):**
- Hobby Plan: $5/month + usage
- Estimated: $20-30/month

**Vercel (Frontend):**
- Hobby Plan: Free
- Pro Plan: $20/month (if needed)

**External Services:**
- Claude API: ~$24/month (100 articles/day)
- YouTube API: Free (under quota)
- Email: Free (iCloud custom domain)
- S3/R2: ~$5/month (storage + requests)

**Total Estimated Cost**: $54-84/month

---

## Support & Troubleshooting

**Common Issues:**

1. **CORS errors:**
   - Check CORS_ORIGINS includes https://foiaarchive.com
   - Verify no trailing slashes

2. **Database connection errors:**
   - Check DATABASE_URL is correct
   - Verify Railway PostgreSQL is running

3. **Migrations fail:**
   - Check alembic_version table
   - Manual run: `alembic upgrade head`

4. **Celery tasks not running:**
   - Check REDIS_URL is correct
   - Verify Celery worker is running
   - Check beat schedule in Railway logs

5. **Email not sending:**
   - Verify iCloud app-specific password
   - Check SMTP credentials
   - Test with curl: `telnet smtp.mail.me.com 587`

---

## Next Steps After Deployment

1. **Seed Agencies:**
   ```bash
   # SSH into Railway container
   python -m app.seed
   ```

2. **Test FOIA Flow:**
   - Create test FOIA request
   - Verify PDF generation
   - Verify S3 upload
   - Verify email sending

3. **Configure Celery:**
   - Verify all tasks are scheduled
   - Check logs for task execution
   - Monitor Redis queue size

4. **Set up monitoring:**
   - Railway metrics
   - Vercel analytics
   - Sentry error tracking (optional)

5. **Backup strategy:**
   - Railway auto-backups (daily)
   - Export critical data weekly
   - Document restore procedure

---

## Emergency Contacts

- Railway Support: https://railway.app/help
- Vercel Support: https://vercel.com/help
- GitHub Issues: https://github.com/jackson-jpeg/FOIAPIPE/issues

---

**Deployment Prepared By**: Claude Sonnet 4.5
**Date**: February 9, 2026
**Version**: Phase 3 Complete (All Production Features)
