# 🚀 Deploy FOIAPIPE to Production - Step by Step

Follow these instructions exactly to deploy to Railway and Vercel.

---

## Part 1: Railway Backend Deployment

### Step 1: Install Railway CLI (if needed)

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login to Railway
railway login
```

### Step 2: Create Railway Project

**Option A: Use Railway Dashboard (Recommended)**
1. Go to https://railway.app/new
2. Click "Empty Project"
3. Name it: `foiapipe-backend`
4. Click "Create"

**Option B: Use CLI**
```bash
cd /Users/jackson/FOIAPIPE
railway init
# Name: foiapipe-backend
```

### Step 3: Add PostgreSQL Database

1. In Railway dashboard, click "+ New"
2. Select "Database" → "PostgreSQL"
3. Wait for it to provision (~30 seconds)
4. Copy the `DATABASE_URL` connection string

### Step 4: Add Redis

1. In Railway dashboard, click "+ New"
2. Select "Database" → "Redis"
3. Wait for it to provision (~30 seconds)
4. Copy the `REDIS_URL` connection string

### Step 5: Deploy API Service

**From Railway Dashboard:**
1. Click "+ New" → "GitHub Repo"
2. Select `jackson-jpeg/FOIAPIPE` repository
3. Railway auto-detects Dockerfile
4. Service name: `api`

**Configure API Service:**
1. Click on the `api` service
2. Go to "Settings" tab
3. Set "Root Directory": `/backend`
4. Go to "Variables" tab
5. Add these environment variables:

```bash
# Database (copy from PostgreSQL service)
DATABASE_URL=${{Postgres.DATABASE_URL}}

# Redis (copy from Redis service)
REDIS_URL=${{Redis.REDIS_URL}}

# Authentication - CHANGE THESE!
SECRET_KEY=<generate-random-64-char-string>
ADMIN_PASSWORD=<your-strong-password>

# CORS - CRITICAL!
CORS_ORIGINS=["https://foiaarchive.com","https://www.foiaarchive.com"]

# Email (iCloud) - Fill in your password
SMTP_HOST=smtp.mail.me.com
SMTP_PORT=587
SMTP_USER=recordsrequest@foiaarchive.com
SMTP_PASSWORD=<your-icloud-app-specific-password>
FROM_EMAIL=recordsrequest@foiaarchive.com
IMAP_HOST=imap.mail.me.com
IMAP_PORT=993
IMAP_USER=recordsrequest@foiaarchive.com
IMAP_PASSWORD=<same-as-smtp>

# S3/R2 Storage - Fill in your credentials
S3_ENDPOINT=<your-r2-endpoint>
S3_ACCESS_KEY=<your-access-key>
S3_SECRET_KEY=<your-secret-key>
S3_BUCKET_NAME=<your-bucket-name>
S3_REGION=us-east-1

# Optional: AI Classification
ANTHROPIC_API_KEY=<your-claude-api-key>

# Optional: YouTube Analytics
YOUTUBE_CLIENT_ID=<youtube-oauth-client-id>
YOUTUBE_CLIENT_SECRET=<youtube-oauth-secret>
YOUTUBE_REFRESH_TOKEN=<youtube-refresh-token>
```

6. Click "Deploy" (top right)
7. Wait for deployment (~2-3 minutes)

**Verify API Deployment:**
```bash
# Get your Railway API URL from dashboard
curl https://your-api.railway.app/api/health

# Should return:
{"status":"ok"}
```

### Step 6: Deploy Celery Worker

1. In Railway dashboard, click "+ New" → "Empty Service"
2. Name: `celery-worker`
3. Connect to GitHub repo: `jackson-jpeg/FOIAPIPE`
4. Settings → Root Directory: `/backend`
5. Settings → Custom Start Command:
   ```bash
   pip install -r requirements.txt && celery -A app.tasks.celery_app worker --loglevel=info
   ```
6. Variables → Reference same variables from API:
   ```bash
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   REDIS_URL=${{Redis.REDIS_URL}}
   SECRET_KEY=${{api.SECRET_KEY}}
   # ... copy all other variables from API service
   ```
7. Deploy

### Step 7: Deploy Celery Beat (Scheduler)

1. In Railway dashboard, click "+ New" → "Empty Service"
2. Name: `celery-beat`
3. Connect to GitHub repo: `jackson-jpeg/FOIAPIPE`
4. Settings → Root Directory: `/backend`
5. Settings → Custom Start Command:
   ```bash
   pip install -r requirements.txt && celery -A app.tasks.celery_app beat --loglevel=info
   ```
6. Variables → Reference same variables from API:
   ```bash
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   REDIS_URL=${{Redis.REDIS_URL}}
   SECRET_KEY=${{api.SECRET_KEY}}
   # ... copy all other variables from API service
   ```
7. Deploy

**Your Railway project should now have 5 services:**
- ✅ PostgreSQL (database)
- ✅ Redis (cache/queue)
- ✅ api (main API server)
- ✅ celery-worker (background jobs)
- ✅ celery-beat (scheduler)

---

## Part 2: Vercel Frontend Deployment

### Step 1: Install Vercel CLI (if needed)

```bash
npm i -g vercel
vercel login
```

### Step 2: Deploy Frontend

**From Vercel Dashboard:**
1. Go to https://vercel.com/new
2. Click "Import Git Repository"
3. Select `jackson-jpeg/FOIAPIPE`
4. Configure project:
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

5. Add Environment Variable:
   ```bash
   VITE_API_URL=https://your-api.railway.app
   ```
   (Get URL from Railway API service dashboard)

6. Click "Deploy"
7. Wait for deployment (~2 minutes)

### Step 3: Configure Domain

1. In Vercel project settings, go to "Domains"
2. Add domain: `foiaarchive.com`
3. Add domain: `www.foiaarchive.com`
4. Vercel will show DNS records to add:
   ```
   Type: A
   Name: @
   Value: 76.76.21.21

   Type: CNAME
   Name: www
   Value: cname.vercel-dns.com
   ```
5. Add these records in your DNS provider (wherever you bought foiaarchive.com)
6. Wait for DNS propagation (5-30 minutes)

### Step 4: Verify Frontend

1. Visit: https://foiaarchive.com
2. Open browser console (F12)
3. Check for errors (should be none)
4. Try logging in:
   - Username: `admin`
   - Password: (the ADMIN_PASSWORD you set in Railway)

---

## Part 3: Post-Deployment Checks

### Check Backend Health

```bash
# Health check
curl https://your-api.railway.app/api/health
# Expected: {"status":"ok"}

# Login test
curl -X POST https://your-api.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"YOUR_PASSWORD"}'
# Expected: {"access_token":"eyJ..."}
```

### Check Database Migrations

In Railway dashboard:
1. Click on `api` service
2. Go to "Deployments" tab
3. Click latest deployment
4. View logs
5. Look for: "Applied 2 migrations"

### Check Celery Tasks

In Railway dashboard:
1. Click on `celery-worker` service
2. View logs
3. Should see: "celery@... ready"
4. Click on `celery-beat` service
5. View logs
6. Should see scheduled tasks

### Seed Initial Data

**Add Tampa Bay agencies:**
1. In Railway dashboard, click `api` service
2. Click "..." → "SSH"
3. Run:
   ```bash
   python -m app.seed
   ```
4. Should see: "Seeded 10 agencies"

### Test Full Flow

1. Visit https://foiaarchive.com
2. Login as admin
3. Go to "News Scanner"
4. Click "Scan Now" button
5. Wait ~30 seconds
6. Articles should appear
7. Select an article
8. Click "File FOIA"
9. Select agency
10. Click "File FOIA Request"
11. Check FOIA page - new request should appear

---

## Troubleshooting

### Problem: CORS errors in browser

**Solution:**
1. Check Railway `api` service variables
2. Verify `CORS_ORIGINS=["https://foiaarchive.com"]`
3. No trailing slashes!
4. Redeploy API service

### Problem: "Database connection failed"

**Solution:**
1. Check Railway Postgres service is running
2. Verify `DATABASE_URL` is referenced in API variables
3. Format: `postgresql+asyncpg://user:pass@host:port/db`

### Problem: Migrations didn't run

**Solution:**
1. Check Railway `api` deployment logs
2. Look for migration errors
3. Manual run: SSH into api service
   ```bash
   alembic -c alembic/alembic.ini upgrade head
   ```

### Problem: Frontend shows "API Error"

**Solution:**
1. Check Vercel environment variable: `VITE_API_URL`
2. Verify Railway API URL is correct
3. Test API health: `curl https://your-api.railway.app/api/health`
4. Redeploy Vercel (rebuilds with new env var)

### Problem: Celery tasks not running

**Solution:**
1. Check `celery-worker` logs in Railway
2. Verify `REDIS_URL` is correct
3. Check `celery-beat` is running
4. Look for "Scheduler: Sending due task" in beat logs

---

## Quick Reference

**Railway URLs:**
- Dashboard: https://railway.app/dashboard
- API: https://your-project.railway.app
- Logs: Click service → "Logs" tab

**Vercel URLs:**
- Dashboard: https://vercel.com/dashboard
- Production: https://foiaarchive.com
- Logs: Click project → "Logs" tab

**Environment Variables Priority:**
1. `SECRET_KEY` - Generate strong random string
2. `ADMIN_PASSWORD` - Set strong password
3. `CORS_ORIGINS` - Must match frontend domain!
4. `DATABASE_URL` - Railway provides
5. `REDIS_URL` - Railway provides
6. Email credentials - For FOIA submissions
7. S3 credentials - For PDF storage

---

## Success Checklist

Backend (Railway):
- [ ] PostgreSQL running
- [ ] Redis running
- [ ] API service deployed
- [ ] Celery worker running
- [ ] Celery beat running
- [ ] Health endpoint returns 200
- [ ] Migrations applied (2 new tables)
- [ ] Login works

Frontend (Vercel):
- [ ] Build successful
- [ ] Domain configured
- [ ] VITE_API_URL set
- [ ] No CORS errors
- [ ] Login page loads
- [ ] Can authenticate

Full System:
- [ ] Can scan news articles
- [ ] Can create FOIA request
- [ ] Can view analytics
- [ ] Email sending works (test)
- [ ] S3 upload works (test)

---

**You're ready to deploy!** Start with Railway backend (Part 1), then Vercel frontend (Part 2).

**Need help?** Check logs in Railway/Vercel dashboards first.
