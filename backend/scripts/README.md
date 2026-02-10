# FOIAPIPE Backup & Restore Scripts

Comprehensive backup and restore tooling for production disaster recovery.

---

## Scripts Overview

### 1. `backup_database.py`
Database-only backup with S3 upload support.

**Features:**
- Creates compressed PostgreSQL dump (custom format)
- Uploads to S3/R2 (optional)
- Automatic cleanup of old backups
- Configurable retention period

**Usage:**
```bash
# Full backup (local + S3)
python scripts/backup_database.py

# Local only (skip S3)
python scripts/backup_database.py --local-only

# S3 only (no local copy)
python scripts/backup_database.py --s3-only

# Custom retention
python scripts/backup_database.py --keep-days=30

# Custom output directory
python scripts/backup_database.py --output-dir=/path/to/backups
```

**Output:**
- File: `backups/foiapipe_backup_YYYYMMDD_HHMMSS.dump`
- Format: PostgreSQL custom format (compressed)
- S3 key: `backups/foiapipe_backup_YYYYMMDD_HHMMSS.dump`

---

### 2. `restore_database.py`
Restore database from local or S3 backup.

**Features:**
- Restore from local backup file
- Download and restore from S3
- List available backups
- Safety confirmation required

**⚠️ WARNING:** This script will **DROP and RECREATE** the database!

**Usage:**
```bash
# List local backups
python scripts/restore_database.py --list

# List S3 backups
python scripts/restore_database.py --list-s3

# Restore from local file
python scripts/restore_database.py backups/foiapipe_backup_20260209_120000.dump

# Restore from S3
python scripts/restore_database.py --from-s3 backups/foiapipe_backup_20260209_120000.dump
```

**Safety:**
- Requires typing "YES" to confirm
- Terminates all active connections
- Drops existing database
- Creates fresh database
- Restores from backup

---

### 3. `backup_full_system.py`
Complete system backup: database + S3 storage.

**Features:**
- Database backup
- Full S3 storage mirror
- Backup manifest (JSON)
- Auto-generated restore guide

**Usage:**
```bash
# Full system backup
python scripts/backup_full_system.py

# Custom output directory
python scripts/backup_full_system.py --output-dir=/path/to/backups
```

**Output:**
```
backups/full_system/foiapipe_full_YYYYMMDD_HHMMSS/
├── foiapipe_backup_YYYYMMDD_HHMMSS.dump  # Database
├── storage/                                # S3 mirror
│   ├── foia/                              # FOIA PDFs
│   ├── videos/                            # Video files
│   ├── thumbnails/                        # Thumbnails
│   └── manifest.json                      # File inventory
└── RESTORE_GUIDE.md                        # Recovery instructions
```

---

## Production Backup Strategy

### Daily Automated Backups

**Railway Cron Job:**
```yaml
# Add to railway.yaml
services:
  - name: backup-daily
    cronSchedule: "0 2 * * *"  # 2 AM UTC
    command: python scripts/backup_database.py --keep-days=7
```

**Or use Celery Beat:**
```python
# Already configured in app/tasks/celery_app.py
@app.task
def daily_backup():
    subprocess.run([
        "python", "scripts/backup_database.py",
        "--keep-days=7"
    ])
```

### Weekly Full Backups

**Celery Beat:**
```python
@app.on_after_finalize.connect
def setup_weekly_full_backup(sender, **kwargs):
    sender.add_periodic_task(
        crontab(hour=3, minute=0, day_of_week=0),  # Sunday 3 AM
        full_system_backup.s(),
        name='weekly-full-backup',
    )

@app.task
def full_system_backup():
    subprocess.run([
        "python", "scripts/backup_full_system.py"
    ])
```

### Backup Retention Policy

- **Daily database backups:** 7 days (local) + 30 days (S3)
- **Weekly full backups:** 30 days
- **Critical backups:** Archive indefinitely

---

## Requirements

### Tools
- PostgreSQL client tools (`pg_dump`, `pg_restore`, `psql`)
- Python 3.12+
- `boto3` (for S3 operations)

### Environment Variables
Must be set (from `.env`):
- `DATABASE_URL` - PostgreSQL connection string
- `S3_ENDPOINT` - S3/R2 endpoint URL
- `S3_ACCESS_KEY` - S3 access key
- `S3_SECRET_KEY` - S3 secret key
- `S3_BUCKET_NAME` - Bucket name
- `S3_REGION` - Region (or "auto" for R2)

### Installation
```bash
# Install PostgreSQL tools (Mac)
brew install postgresql@16

# Install PostgreSQL tools (Ubuntu/Debian)
sudo apt-get install postgresql-client-16

# Install Python dependencies
pip install boto3
```

---

## Recovery Scenarios

### Scenario 1: Database Corruption
**Recovery Time:** ~10 minutes

```bash
# 1. List recent backups
python scripts/restore_database.py --list

# 2. Restore most recent
python scripts/restore_database.py backups/foiapipe_backup_20260209_020000.dump

# 3. Verify
psql $DATABASE_URL -c "SELECT COUNT(*) FROM news_articles;"
```

### Scenario 2: Complete System Failure
**Recovery Time:** ~30-60 minutes

```bash
# 1. List full backups
ls -lh backups/full_system/

# 2. Restore database
python scripts/restore_database.py backups/full_system/foiapipe_full_20260209_030000/foiapipe_backup_20260209_030000.dump

# 3. Restore storage (use guide)
cd backups/full_system/foiapipe_full_20260209_030000
cat RESTORE_GUIDE.md
```

### Scenario 3: Accidental Data Deletion
**Recovery Time:** ~5 minutes

```bash
# 1. Restore from backup BEFORE deletion
python scripts/restore_database.py --list

# 2. Find backup timestamp before deletion
python scripts/restore_database.py backups/foiapipe_backup_20260209_010000.dump
```

---

## Testing Backups

### Monthly Backup Test

**Schedule:** First Sunday of each month

**Procedure:**
1. Create a test database
2. Restore backup to test database
3. Verify data integrity
4. Document results

**Script:**
```bash
#!/bin/bash
# test_backup.sh

# Create test database
createdb foiapipe_test

# Restore latest backup
export DATABASE_URL="postgresql://user:pass@localhost/foiapipe_test"
python scripts/restore_database.py backups/foiapipe_backup_latest.dump

# Verify counts
psql $DATABASE_URL -c "SELECT
    (SELECT COUNT(*) FROM news_articles) as articles,
    (SELECT COUNT(*) FROM foia_requests) as foias,
    (SELECT COUNT(*) FROM videos) as videos;"

# Cleanup
dropdb foiapipe_test
```

---

## Monitoring

### Backup Success Alerts

**Slack/Email:**
```python
# Add to backup scripts
if backup_success:
    send_notification("✅ Backup completed successfully")
else:
    send_alert("❌ BACKUP FAILED - Immediate attention required")
```

### Backup Size Monitoring

**Alert if:**
- Backup size drops >20% unexpectedly (data loss?)
- Backup size grows >50% unexpectedly (check needed)
- Backup time >30 minutes (performance issue)

---

## Troubleshooting

### "Permission denied"
```bash
# Grant createdb privilege
psql postgres -c "ALTER USER your_user CREATEDB;"
```

### "Out of disk space"
```bash
# Check available space
df -h

# Clean up old backups manually
rm backups/foiapipe_backup_2026*.dump

# Or reduce retention
python scripts/backup_database.py --keep-days=3
```

### "S3 upload timeout"
```bash
# Use local-only mode
python scripts/backup_database.py --local-only

# Then manually upload later
aws s3 cp backups/foiapipe_backup_20260209_120000.dump \
    s3://your-bucket/backups/ \
    --endpoint-url=https://your-endpoint.com
```

### "Restore takes too long"
```bash
# Use parallel restore (if supported)
pg_restore -j 4 ...  # 4 parallel jobs

# Or restore only specific tables
pg_restore --table=news_articles ...
```

---

## Security

### Backup Encryption

**S3 Server-Side Encryption:**
```python
# Add to upload_file() in storage.py
ExtraArgs={'ServerSideEncryption': 'AES256'}
```

**Local Encryption:**
```bash
# Encrypt backup before storing
gpg --encrypt --recipient your@email.com foiapipe_backup.dump
```

### Access Control

- Limit backup script access to admin users only
- Use separate S3 bucket for backups with restricted access
- Rotate S3 credentials regularly
- Never commit backup files to git

---

## See Also

- [PRE_DEPLOYMENT_CHECKLIST.md](../../PRE_DEPLOYMENT_CHECKLIST.md) - Deployment guide
- [DEPLOYMENT_GUIDE.md](../../DEPLOYMENT_GUIDE.md) - Production deployment
- Railway docs: https://docs.railway.app/reference/cron-jobs

---

*FOIAPIPE v1.0 - Backup & Recovery Documentation*
