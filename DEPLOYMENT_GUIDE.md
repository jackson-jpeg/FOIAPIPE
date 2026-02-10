# FOIAPIPE Deployment Guide

## Railway Deployment

### Prerequisites
- Railway account: https://railway.app
- GitHub repository connected
- Environment variables configured

---

## Step 1: Database Setup

### PostgreSQL Configuration
1. Create PostgreSQL service in Railway
2. Note the connection string from `DATABASE_URL`
3. Enable automatic backups:
   - Go to PostgreSQL service settings
   - Navigate to "Backups" tab
   - Enable daily backups
   - Set retention: **30 days minimum**
   - Verify backup schedule: Daily at 2 AM UTC

### Redis Configuration
1. Create Redis service in Railway
2. Note the connection string from `REDIS_URL`

---

## Step 2: Environment Variables

Add these to Railway project settings:

### Required for Boot
```env
DATABASE_URL=<from Railway PostgreSQL>
REDIS_URL=<from Railway Redis>
SECRET_KEY=<generate with: openssl rand -hex 32>
ADMIN_PASSWORD=<your secure password>
```

### Email Configuration (iCloud)
```env
# SMTP (outgoing)
SMTP_HOST=smtp.mail.me.com
SMTP_PORT=587
SMTP_USER=recordsrequest@foiaarchive.com
SMTP_PASSWORD=<iCloud app-specific password>
FROM_EMAIL=recordsrequest@foiaarchive.com

# IMAP (incoming)
IMAP_HOST=imap.mail.me.com
IMAP_PORT=993
IMAP_USER=recordsrequest@foiaarchive.com
IMAP_PASSWORD=<same app-specific password>
```

### API Keys (Optional but Recommended)
```env
# Claude AI for classification
ANTHROPIC_API_KEY=<your anthropic API key>

# YouTube Data API
YOUTUBE_CLIENT_ID=<from Google Console>
YOUTUBE_CLIENT_SECRET=<from Google Console>
YOUTUBE_REFRESH_TOKEN=<from OAuth flow>

# Cloudflare R2 or AWS S3
S3_ENDPOINT=<R2 endpoint or leave blank for AWS>
S3_ACCESS_KEY=<your access key>
S3_SECRET_KEY=<your secret key>
S3_BUCKET_NAME=foiapipe-storage
S3_REGION=auto  # for R2, or us-east-1 for AWS
```

### Notifications (Optional)
```env
# Twilio for SMS alerts
TWILIO_ACCOUNT_SID=<your Twilio SID>
TWILIO_AUTH_TOKEN=<your Twilio token>
TWILIO_FROM_NUMBER=<your Twilio phone>
NOTIFICATION_PHONE=<your personal phone>
NOTIFICATION_EMAIL=<your personal email>
```

### Application Settings
```env
# CRITICAL: Start with auto-submit disabled!
AUTO_SUBMIT_ENABLED=false
MAX_AUTO_SUBMITS_PER_DAY=5
SCAN_INTERVAL_MINUTES=30

# CORS (adjust for your frontend domain)
CORS_ORIGINS=["http://localhost:3000","https://foiapipe.com"]
```

---

## Step 3: Deploy Backend

### Option A: Automatic Deployment (Recommended)
1. Connect GitHub repository to Railway
2. Select `main` branch
3. Set root directory: `/backend`
4. Railway auto-detects Python and runs:
   ```bash
   pip install -r requirements.txt
   python -m app.main
   ```
5. Watch deployment logs for errors

### Option B: Manual Deployment
```bash
# From project root
cd backend
pip install -r requirements.txt

# Run migrations
PYTHONPATH=. alembic -c alembic/alembic.ini upgrade head

# Seed agencies
python -m app.seed

# Start server
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

---

## Step 4: Deploy Celery Worker

Create a **separate Railway service** for the Celery worker:

### Service Configuration
```bash
# Start command
celery -A app.tasks.celery_app worker --loglevel=info
```

### Environment Variables
- Copy all environment variables from main backend service
- Both services need access to same DATABASE_URL and REDIS_URL

---

## Step 5: Deploy Celery Beat Scheduler

Create another **separate Railway service** for Celery Beat:

### Service Configuration
```bash
# Start command
celery -A app.tasks.celery_app beat --loglevel=info
```

### Environment Variables
- Copy all environment variables from main backend service

---

## Step 6: Deploy Frontend

### Build Configuration
```bash
cd frontend
npm install
npm run build
```

### Deployment Options

#### Option A: Railway
1. Create new service for frontend
2. Set root directory: `/frontend`
3. Build command: `npm run build`
4. Start command: `npm run preview` or use serve

#### Option B: Cloudflare Pages (Recommended)
1. Connect GitHub repository
2. Build command: `npm run build`
3. Output directory: `dist`
4. Auto-deploys on push to main

#### Option C: Vercel
1. Import GitHub repository
2. Framework: Vite
3. Root directory: `frontend`
4. Auto-deploys on push to main

---

## Step 7: Database Migrations

### Initial Setup
```bash
# From backend directory
source venv/bin/activate
PYTHONPATH=. alembic -c alembic/alembic.ini upgrade head
```

### Seed Initial Data
```bash
python -m app.seed
```

This creates:
- Tampa Police Department
- Hillsborough County Sheriff's Office
- St. Petersburg Police Department
- Pinellas County Sheriff's Office
- Clearwater Police Department
- Pasco County Sheriff's Office
- Florida Highway Patrol
- And other Tampa Bay agencies

---

## Step 8: Verify Deployment

### Health Checks
```bash
# Basic health
curl https://your-app.railway.app/api/health

# Detailed health
curl https://your-app.railway.app/api/health/detailed
```

Expected response:
```json
{
  "status": "ok",
  "checks": {
    "database": {"status": "ok"},
    "redis": {"status": "ok"},
    "storage": {"status": "ok" or "not_configured"},
    "circuit_breakers": {"status": "ok", "healthy_sources": 0},
    "migrations": {"status": "ok"},
    "email_smtp": {"status": "configured"},
    "claude_api": {"status": "configured"}
  }
}
```

### Test Endpoints
```bash
# Login
curl -X POST https://your-app.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your-password"}'

# Get token and test authenticated endpoint
curl https://your-app.railway.app/api/dashboard/summary \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Step 9: Post-Deployment Configuration

### 1. Test News Scanning
```bash
# Trigger manual scan (via API)
curl -X POST https://your-app.railway.app/api/news/scan-now \
  -H "Authorization: Bearer YOUR_TOKEN"

# Check scan results
curl https://your-app.railway.app/api/news \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 2. Review Circuit Breakers
```bash
curl https://your-app.railway.app/api/circuit-breakers/summary \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3. Verify Celery Tasks
Check Railway logs for:
- `scan-news-rss` running every 30 minutes
- `check-foia-inbox` running every 15 minutes
- `poll-youtube-analytics` running daily at 2 AM

### 4. Test FOIA Generation
1. Find a high-severity article in dashboard
2. Click "File FOIA"
3. Review generated request text
4. Submit to test agency (Temple Terrace PD recommended for first test)

---

## Step 10: Enable Auto-Submit (After Testing)

**⚠️ ONLY after first 5 manual FOIAs succeed:**

1. Update Railway environment variable:
   ```env
   AUTO_SUBMIT_ENABLED=true
   ```
2. Restart backend service
3. Monitor logs for 72 hours
4. Review auto-submitted FOIAs daily

---

## Monitoring & Maintenance

### Daily Checks
- [ ] Review circuit breaker status
- [ ] Check for new high-severity articles
- [ ] Monitor FOIA submission success rate
- [ ] Review health endpoint status

### Weekly Checks
- [ ] Verify database backups are running
- [ ] Check storage usage
- [ ] Review revenue analytics
- [ ] Test email inbox monitoring

### Monthly Checks
- [ ] Review agency response rates
- [ ] Update agency contact information if changed
- [ ] Optimize scanning intervals based on traffic
- [ ] Review and update FOIA templates

---

## Backup & Recovery

### Database Backups (Railway)
- **Automatic:** Daily at 2 AM UTC
- **Retention:** 30 days
- **Manual backup:** Use Railway dashboard "Create Backup" button
- **Restore:** Railway dashboard > Backups > Restore

### Manual Backup Script
```bash
# From local machine with Railway CLI
railway run pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
```

### Disaster Recovery
1. Create new PostgreSQL service in Railway
2. Restore from most recent backup
3. Update `DATABASE_URL` environment variable
4. Run migrations: `alembic upgrade head`
5. Restart all services

---

## Troubleshooting

### "Database connection failed"
- Check `DATABASE_URL` is correct
- Verify PostgreSQL service is running
- Check Railway service logs

### "Celery tasks not running"
- Verify Celery worker service is running
- Check Redis connection
- Review Celery worker logs in Railway

### "Email sending fails"
- Verify iCloud app-specific password
- Check SMTP settings
- Test with manual email send

### "News scanner finds no articles"
- Check circuit breaker status
- Verify RSS feeds are reachable
- Review scan logs
- Test individual feeds manually

### "High memory usage"
- Increase Railway plan tier
- Optimize Celery worker concurrency
- Review database query performance

---

## Security Checklist

- [ ] All secrets in environment variables (not code)
- [ ] `AUTO_SUBMIT_ENABLED=false` initially
- [ ] Strong `ADMIN_PASSWORD` set
- [ ] `SECRET_KEY` is cryptographically random
- [ ] CORS origins restricted to your domain
- [ ] Database backups enabled and tested
- [ ] Railway services use private networking
- [ ] API rate limiting enabled (FastAPI default)
- [ ] Git repository doesn't contain `.env` file

---

## Cost Estimates (Railway)

### Starter ($5/month per service)
- Backend API: $5/mo
- Celery Worker: $5/mo
- Celery Beat: $5/mo
- PostgreSQL: $5/mo
- Redis: $5/mo
- **Total:** ~$25/month

### With Resources ($20/month per service)
- If high traffic, upgrade services as needed
- **Estimated:** $50-100/month

### Additional Costs
- Cloudflare R2: $0.015/GB (~$1-5/month for videos)
- Anthropic API: ~$0.25 per 1M tokens (~$10/month)
- YouTube API: Free (quota-based)
- Domain: ~$12/year

**Total estimated monthly cost: $35-120**

---

## Performance Optimization

### Database
- Add indexes for frequently queried columns
- Use connection pooling (already configured)
- Monitor slow queries

### Redis
- Monitor memory usage
- Set eviction policy: `allkeys-lru`

### Celery
- Adjust worker concurrency based on load
- Monitor task queue depth
- Set task timeouts appropriately

### Storage
- Use CDN for video thumbnails
- Compress images before upload
- Set aggressive caching headers

---

## Next Steps After Deployment

1. **Week 1:** Monitor daily, keep auto-submit disabled
2. **Week 2:** Enable auto-submit for one trusted agency
3. **Week 3:** Gradually enable for all agencies
4. **Month 2:** Review analytics, optimize based on data
5. **Month 3:** Add video editing automation
6. **Month 6:** Consider multi-city expansion

---

*Last Updated: 2026-02-09*
*FOIAPIPE v1.0*
