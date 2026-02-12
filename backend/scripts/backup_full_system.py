#!/usr/bin/env python3
"""Full system backup: database + S3 storage mirror.

Usage:
    python scripts/backup_full_system.py [--output-dir=/path/to/backups]

This script:
1. Creates a database backup
2. Downloads all S3 files to a local mirror
3. Creates a manifest of all backed-up files
4. Generates a restore guide

Use this for complete disaster recovery planning.
"""

import argparse
import json
import subprocess
import sys
from datetime import datetime
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import settings


def backup_database(backup_dir: Path) -> Path | None:
    """Run database backup script.

    Args:
        backup_dir: Directory to save backups

    Returns:
        Path to backup file if successful, None otherwise
    """
    print("\n" + "=" * 80)
    print("STEP 1: DATABASE BACKUP")
    print("=" * 80)

    scripts_dir = Path(__file__).resolve().parent
    backup_script = scripts_dir / "backup_database.py"

    if not backup_script.exists():
        print(f"❌ Backup script not found: {backup_script}")
        return None

    try:
        result = subprocess.run(
            [
                sys.executable,
                str(backup_script),
                "--local-only",
                f"--output-dir={backup_dir}",
            ],
            check=True,
            capture_output=True,
            text=True,
        )

        print(result.stdout)

        # Find the created backup file (most recent)
        backups = sorted(backup_dir.glob("foiaarchive_backup_*.dump"), reverse=True)
        if backups:
            return backups[0]
        else:
            print("❌ No backup file created")
            return None

    except subprocess.CalledProcessError as e:
        print(f"❌ Database backup failed: {e.stderr}")
        return None


def backup_s3_storage(backup_dir: Path) -> dict:
    """Download all files from S3 to local mirror.

    Args:
        backup_dir: Directory to save S3 files

    Returns:
        Dict with statistics (files_count, total_size, errors)
    """
    print("\n" + "=" * 80)
    print("STEP 2: S3 STORAGE MIRROR")
    print("=" * 80)

    if not settings.S3_BUCKET_NAME:
        print("⚠️  S3 not configured, skipping storage backup")
        return {"files_count": 0, "total_size": 0, "errors": 0}

    storage_dir = backup_dir / "storage"
    storage_dir.mkdir(parents=True, exist_ok=True)

    print(f"Downloading all files from S3: {settings.S3_BUCKET_NAME}")

    try:
        import boto3

        s3 = boto3.client(
            "s3",
            endpoint_url=settings.S3_ENDPOINT,
            aws_access_key_id=settings.S3_ACCESS_KEY,
            aws_secret_access_key=settings.S3_SECRET_KEY,
            region_name=settings.S3_REGION or "auto",
        )

        # List all objects
        paginator = s3.get_paginator("list_objects_v2")
        pages = paginator.paginate(Bucket=settings.S3_BUCKET_NAME)

        files_count = 0
        total_size = 0
        errors = 0
        manifest = []

        for page in pages:
            if "Contents" not in page:
                continue

            for obj in page["Contents"]:
                key = obj["Key"]
                size = obj["Size"]

                # Download file
                local_path = storage_dir / key
                local_path.parent.mkdir(parents=True, exist_ok=True)

                try:
                    print(f"  Downloading: {key} ({size / (1024 * 1024):.2f} MB)")
                    s3.download_file(
                        settings.S3_BUCKET_NAME,
                        key,
                        str(local_path),
                    )

                    files_count += 1
                    total_size += size

                    # Add to manifest
                    manifest.append({
                        "key": key,
                        "size": size,
                        "last_modified": obj["LastModified"].isoformat(),
                        "local_path": str(local_path.relative_to(backup_dir)),
                    })

                except Exception as e:
                    print(f"    ❌ Error: {e}")
                    errors += 1

        # Save manifest
        manifest_path = storage_dir / "manifest.json"
        with open(manifest_path, "w") as f:
            json.dump(manifest, f, indent=2)

        print(f"\n✅ Downloaded {files_count} files ({total_size / (1024 * 1024):.2f} MB)")
        print(f"✅ Manifest saved: {manifest_path}")

        if errors > 0:
            print(f"⚠️  {errors} files failed to download")

        return {
            "files_count": files_count,
            "total_size": total_size,
            "errors": errors,
            "manifest": manifest,
        }

    except Exception as e:
        print(f"❌ S3 backup failed: {e}")
        return {"files_count": 0, "total_size": 0, "errors": 1}


def create_restore_guide(backup_dir: Path, db_backup: Path | None, storage_stats: dict):
    """Create a restore guide document.

    Args:
        backup_dir: Backup directory
        db_backup: Path to database backup file
        storage_stats: S3 backup statistics
    """
    print("\n" + "=" * 80)
    print("STEP 3: RESTORE GUIDE")
    print("=" * 80)

    guide_path = backup_dir / "RESTORE_GUIDE.md"

    timestamp = datetime.now().isoformat()
    db_backup_name = db_backup.name if db_backup else "N/A"

    guide_content = f"""# FOIA Archive Full System Restore Guide

**Backup Date:** {timestamp}
**Database Backup:** {db_backup_name}
**Storage Files:** {storage_stats['files_count']} files ({storage_stats['total_size'] / (1024 * 1024):.2f} MB)

---

## Prerequisites

1. PostgreSQL client tools (`pg_restore`, `psql`)
2. Python 3.12+
3. S3/R2 bucket access (if restoring storage)
4. Railway CLI (if restoring to Railway)

---

## Step 1: Restore Database

### Local Restore
```bash
# From this backup directory
python ../../scripts/restore_database.py {db_backup_name}
```

### Railway Restore
```bash
# Copy backup to Railway
railway run python scripts/restore_database.py --from-s3 backups/{db_backup_name}

# Or upload first, then restore
railway run python scripts/restore_database.py /path/to/{db_backup_name}
```

---

## Step 2: Restore S3 Storage

### Upload to S3/R2
```bash
# Install AWS CLI
pip install awscli

# Configure credentials
export AWS_ACCESS_KEY_ID=your_key
export AWS_SECRET_ACCESS_KEY=your_secret

# Upload all files (from this backup directory)
cd storage
aws s3 sync . s3://your-bucket-name/ \\
    --endpoint-url=https://your-endpoint.com \\
    --region=auto
```

### Verify Upload
```bash
# Check manifest
cat storage/manifest.json

# Verify file count
aws s3 ls s3://your-bucket-name/ --recursive | wc -l
# Should match: {storage_stats['files_count']}
```

---

## Step 3: Verify System

### Database Check
```bash
# Count records
psql $DATABASE_URL -c "SELECT COUNT(*) FROM news_articles;"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM foia_requests;"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM videos;"
```

### API Health Check
```bash
curl https://your-app.railway.app/api/health/detailed
```

### Storage Check
```bash
# Test file access
curl https://your-app.railway.app/api/videos
# Verify thumbnails load
```

---

## Backup Contents

### Database
- File: `{db_backup_name}`
- All tables, indexes, constraints
- Full data snapshot

### Storage
- Directory: `storage/`
- Manifest: `storage/manifest.json`
- Files: {storage_stats['files_count']} total

---

## Troubleshooting

### "Database already exists"
The restore script will drop and recreate the database. Make sure you have a backup of the current database first!

### "Permission denied"
Ensure the PostgreSQL user has createdb privileges:
```sql
ALTER USER your_user CREATEDB;
```

### "S3 upload failed"
Check your S3 credentials and bucket permissions. The bucket must allow PutObject.

### "Missing files"
Check `storage/manifest.json` for the complete list of files that should be present.

---

## Recovery Time Estimate

- **Database restore:** ~5-15 minutes (depending on size)
- **Storage upload:** ~{storage_stats['total_size'] / (1024 * 1024 * 10):.0f} minutes at 10 MB/s
- **Total:** ~{(storage_stats['total_size'] / (1024 * 1024 * 10)) + 15:.0f} minutes

---

*Backup created: {timestamp}*
*FOIA Archive v1.0*
"""

    with open(guide_path, "w") as f:
        f.write(guide_content)

    print(f"✅ Restore guide created: {guide_path}")


def main():
    """Run full system backup."""
    parser = argparse.ArgumentParser(description="Full FOIA Archive system backup")
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path(__file__).resolve().parent.parent / "backups" / "full_system",
        help="Directory to save full backup",
    )

    args = parser.parse_args()

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_dir = args.output_dir / f"foiaarchive_full_{timestamp}"
    backup_dir.mkdir(parents=True, exist_ok=True)

    print("=" * 80)
    print("FOIA ARCHIVE FULL SYSTEM BACKUP")
    print(f"Started: {datetime.now().isoformat()}")
    print(f"Output: {backup_dir}")
    print("=" * 80)

    # Step 1: Database backup
    db_backup = backup_database(backup_dir)
    if not db_backup:
        print("\n❌ Database backup failed, aborting")
        return 1

    # Step 2: S3 storage backup
    storage_stats = backup_s3_storage(backup_dir)

    # Step 3: Create restore guide
    create_restore_guide(backup_dir, db_backup, storage_stats)

    # Final summary
    print("\n" + "=" * 80)
    print("FULL BACKUP COMPLETE")
    print("=" * 80)
    print(f"Location: {backup_dir}")
    print(f"\nDatabase backup:    ✅ {db_backup.name}")
    print(f"Storage files:      ✅ {storage_stats['files_count']} files")
    print(f"Total storage:      {storage_stats['total_size'] / (1024 * 1024):.2f} MB")

    if storage_stats['errors'] > 0:
        print(f"⚠️  Errors:          {storage_stats['errors']} files failed")

    print(f"\nRestore guide: {backup_dir / 'RESTORE_GUIDE.md'}")
    print("=" * 80)

    return 0 if storage_stats['errors'] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
