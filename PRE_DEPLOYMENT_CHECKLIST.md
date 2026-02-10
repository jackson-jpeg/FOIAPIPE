# FOIAPIPE Pre-Deployment Checklist

**Target:** Railway Production Deployment
**Date:** 2026-02-09
**Version:** 1.0

---

## ✅ Code Readiness

### Core Features
- [x] News scanner with 5 RSS feeds
- [x] Article classification with AI
- [x] Smart filtering (68% junk removal)
- [x] FOIA request generation
- [x] Email sending (SMTP)
- [x] Email monitoring (IMAP)
- [x] Circuit breakers for reliability
- [x] Idempotency constraints
- [x] Health check endpoints
- [x] Revenue tracking
- [x] Analytics dashboard
- [x] Video thumbnail generation
- [x] Cost prediction for FOIA requests
- [x] ROI projection and break-even analysis
- [x] Smart YouTube publishing scheduler
- [x] Agency-specific FOIA templates
- [x] Automated appeal generator for denials
- [x] Database backup & restore scripts

### Database
- [x] All migrations created
- [x] Migrations tested locally
- [x] Seed data for Tampa Bay agencies
- [x] Idempotency constraints in place
- [x] UUID v7 primary keys
- [x] Timestamps on all tables

### API Endpoints
- [x] Authentication (`/api/auth/login`)
- [x] News scanner (`/api/news/*`)
- [x] FOIA management (`/api/foia/*`)
  - [x] Cost prediction (`/api/foia/cost-prediction`)
  - [x] ROI projection (`/api/foia/roi-projection`)
  - [x] Appeal generation (`/api/foia/{id}/generate-appeal`)
- [x] Analytics (`/api/analytics/*`)
  - [x] FOIA performance by agency
  - [x] Video profitability ranking
  - [x] Revenue break-even analysis
- [x] Health checks (`/api/health/detailed`)
- [x] Circuit breakers (`/api/circuit-breakers/*`)
- [x] Videos (`/api/videos/*`)
- [x] Agencies (`/api/agencies/*`)
  - [x] Template management (`/api/agencies/{id}/template`)

### Background Tasks (Celery)
- [x] News RSS scanning (every 30 min)
- [x] News scraping (every 2 hours)
- [x] FOIA inbox checking (every 15 min)
- [x] FOIA deadline alerts (daily 8 AM)
- [x] YouTube analytics polling (daily 2 AM)
- [x] Daily summary email (daily 9 AM)
- [x] Cleanup old logs (weekly)

### Testing
- [x] RSS feed validation test
- [x] Circuit breaker test
- [x] End-to-end pipeline test
- [x] Article filtering test
- [x] All tests passing

---

## 🔐 Security Checklist

### Secrets Management
- [ ] `SECRET_KEY` generated (32+ bytes random)
- [ ] `ADMIN_PASSWORD` is strong (12+ chars, mixed case, numbers, symbols)
- [ ] No secrets in git repository
- [ ] `.env` in `.gitignore`
- [ ] `.env.example` created without actual secrets

### Access Control
- [ ] Single admin user configured
- [ ] JWT authentication enabled
- [ ] CORS origins restricted to production domain
- [ ] API rate limiting enabled (FastAPI default)

### Email Security
- [ ] iCloud app-specific password created (not main password!)
- [ ] SMTP credentials secured
- [ ] IMAP credentials secured
- [ ] Email FROM address verified

### Safety Switches
- [ ] `AUTO_SUBMIT_ENABLED=false` initially
- [ ] `MAX_AUTO_SUBMITS_PER_DAY=5` set conservatively
- [ ] FOIA email templates reviewed
- [ ] Test agency identified for first submission

---

## 🌐 Infrastructure Setup

### Railway Services Needed
- [ ] Backend API service
- [ ] Celery worker service
- [ ] Celery beat scheduler service
- [ ] PostgreSQL database
- [ ] Redis cache

### Database Configuration
- [ ] PostgreSQL service created
- [ ] Daily backups enabled (2 AM UTC)
- [ ] 30-day retention configured
- [ ] `DATABASE_URL` noted
- [ ] Test backup restore

### Redis Configuration
- [ ] Redis service created
- [ ] `REDIS_URL` noted
- [ ] Eviction policy: `allkeys-lru`

### Storage (S3/R2)
- [ ] Cloudflare R2 or AWS S3 bucket created
- [ ] Bucket name: `foiapipe-storage`
- [ ] CORS configured for uploads
- [ ] Access keys generated
- [ ] Test upload/download

---

## 📧 Email Configuration

### iCloud Setup
- [ ] Custom domain configured (foiaarchive.com)
- [ ] recordsrequest@foiaarchive.com created
- [ ] App-specific password generated
- [ ] SMTP settings verified:
  - Host: smtp.mail.me.com
  - Port: 587 (STARTTLS)
- [ ] IMAP settings verified:
  - Host: imap.mail.me.com
  - Port: 993 (SSL)
- [ ] Test email sent successfully
- [ ] Test email received successfully

### Email Templates
- [ ] FOIA request template reviewed
- [ ] Professional signature included
- [ ] Legal disclaimer included
- [ ] Contact information correct

---

## 🔌 API Keys & Integrations

### Anthropic (Claude AI)
- [ ] API key obtained
- [ ] Billing configured
- [ ] Usage limits set
- [ ] Test classification successful

### YouTube Data API
- [ ] Google Cloud project created
- [ ] YouTube Data API v3 enabled
- [ ] YouTube Analytics API enabled
- [ ] OAuth 2.0 credentials created
- [ ] Refresh token obtained
- [ ] Test video upload (unlisted)

### Twilio (SMS Notifications) - Optional
- [ ] Account created
- [ ] Phone number purchased
- [ ] Credentials obtained
- [ ] Test SMS sent

---

## 🚀 Deployment Steps

### 1. Environment Variables
```bash
# Create .env.production with:
DATABASE_URL=<Railway PostgreSQL>
REDIS_URL=<Railway Redis>
SECRET_KEY=<generated>
ADMIN_PASSWORD=<strong password>

# Email (iCloud)
SMTP_HOST=smtp.mail.me.com
SMTP_PORT=587
SMTP_USER=recordsrequest@foiaarchive.com
SMTP_PASSWORD=<app-specific password>
IMAP_HOST=imap.mail.me.com
IMAP_PORT=993
IMAP_USER=recordsrequest@foiaarchive.com
IMAP_PASSWORD=<app-specific password>
FROM_EMAIL=recordsrequest@foiaarchive.com

# API Keys
ANTHROPIC_API_KEY=<key>
YOUTUBE_CLIENT_ID=<id>
YOUTUBE_CLIENT_SECRET=<secret>
YOUTUBE_REFRESH_TOKEN=<token>

# Storage
S3_ENDPOINT=<R2 endpoint>
S3_ACCESS_KEY=<key>
S3_SECRET_KEY=<secret>
S3_BUCKET_NAME=foiapipe-storage
S3_REGION=auto

# App Settings
AUTO_SUBMIT_ENABLED=false
MAX_AUTO_SUBMITS_PER_DAY=5
SCAN_INTERVAL_MINUTES=30
CORS_ORIGINS=["https://foiapipe.com"]
```

### 2. Deploy to Railway
- [ ] Connect GitHub repository
- [ ] Deploy backend service
- [ ] Deploy Celery worker service
- [ ] Deploy Celery beat service
- [ ] Verify all services running

### 3. Run Database Migrations
```bash
railway run alembic -c alembic/alembic.ini upgrade head
```

### 4. Seed Initial Data
```bash
railway run python -m app.seed
```

### 5. Deploy Frontend
- [ ] Deploy to Cloudflare Pages / Vercel
- [ ] Update API base URL
- [ ] Verify build successful
- [ ] Test login from frontend

---

## ✅ Post-Deployment Verification

### Health Checks
```bash
# Basic health
curl https://your-app.railway.app/api/health
# Expected: {"status": "ok"}

# Detailed health
curl https://your-app.railway.app/api/health/detailed
# Expected: All services "ok"
```

### Authentication
```bash
# Login test
curl -X POST https://your-app.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your-password"}'
# Expected: {"access_token": "...", "token_type": "bearer"}
```

### News Scanner
```bash
# Manual scan trigger
curl -X POST https://your-app.railway.app/api/news/scan-now \
  -H "Authorization: Bearer YOUR_TOKEN"
# Expected: {"found": X, "new": Y, "filtered": Z}
```

### Circuit Breakers
```bash
curl https://your-app.railway.app/api/circuit-breakers/summary \
  -H "Authorization: Bearer YOUR_TOKEN"
# Expected: {"total_sources": 0, "circuits_open": 0, ...}
```

### Database
```bash
# Check agencies loaded
curl https://your-app.railway.app/api/agencies \
  -H "Authorization: Bearer YOUR_TOKEN"
# Expected: 10 Tampa Bay agencies
```

---

## 📊 Monitoring Setup

### Railway Dashboard
- [ ] All services showing "Active"
- [ ] No deployment errors in logs
- [ ] Memory usage < 80%
- [ ] CPU usage normal

### Application Logs
- [ ] Celery worker connected to Redis
- [ ] Celery beat scheduling tasks
- [ ] No critical errors in logs
- [ ] Database connections successful

### Scheduled Tasks
- [ ] RSS scan runs every 30 minutes
- [ ] FOIA inbox check runs every 15 minutes
- [ ] No task failures

---

## 🧪 First Production Test

### Week 1 Testing Plan
1. **Day 1-2:** Monitor passive scanning
   - [ ] News scanner finds articles
   - [ ] Articles classified correctly
   - [ ] High-severity articles flagged
   - [ ] No circuit breakers opened

2. **Day 3:** First manual FOIA
   - [ ] Select high-severity article
   - [ ] Review generated FOIA text
   - [ ] Submit to friendly agency (Temple Terrace PD)
   - [ ] Verify email sent successfully
   - [ ] Track in dashboard

3. **Day 4-7:** Monitor FOIA response
   - [ ] Inbox monitoring working
   - [ ] Agency response detected
   - [ ] Status updated automatically
   - [ ] Notifications received

### Week 2: Gradual Rollout
- [ ] Submit 2-3 more FOIAs to different agencies
- [ ] Verify all submissions successful
- [ ] Check response rates
- [ ] Review costs

### Week 3: Enable Auto-Submit
- [ ] If 5/5 manual FOIAs succeeded, enable:
  ```env
  AUTO_SUBMIT_ENABLED=true
  ```
- [ ] Monitor auto-submissions closely
- [ ] Review every auto-submitted FOIA
- [ ] Adjust severity threshold if needed

---

## 🚨 Rollback Plan

### If Critical Issues Arise

#### Option 1: Disable Auto-Submit
```env
AUTO_SUBMIT_ENABLED=false
```

#### Option 2: Pause Celery Tasks
- Stop Celery worker service
- Stop Celery beat service
- Backend API remains running for manual operations

#### Option 3: Full Rollback
1. Stop all services
2. Restore database from backup
3. Deploy previous git commit
4. Investigate issues
5. Redeploy when fixed

### Emergency Contacts
- Railway Support: https://railway.app/help
- Cloudflare Support: (for R2/Pages)
- iCloud Support: (for email issues)

---

## 📋 Final Checklist

Before deploying, verify:
- [ ] All secrets configured
- [ ] Database backups enabled
- [ ] Email credentials tested
- [ ] API keys valid
- [ ] Tests passing
- [ ] Code committed to main
- [ ] Deployment guide reviewed
- [ ] Rollback plan understood
- [ ] Monitoring configured
- [ ] First test agency identified

---

## 🎉 Ready to Deploy!

Once all boxes are checked:

```bash
# 1. Push final code
git push origin main

# 2. Deploy to Railway
# (Railway auto-deploys on push if configured)

# 3. Run migrations
railway run alembic upgrade head

# 4. Seed data
railway run python -m app.seed

# 5. Verify health
curl https://your-app.railway.app/api/health/detailed

# 6. Start monitoring!
```

---

*FOIAPIPE v1.0 - Production Deployment*
*Good luck! 🚀*
