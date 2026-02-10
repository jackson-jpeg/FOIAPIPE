#!/usr/bin/env python3
"""Database backup script with S3 upload and local storage.

Usage:
    python scripts/backup_database.py [--local-only] [--s3-only] [--keep-days=7]

This script:
1. Creates a pg_dump of the PostgreSQL database
2. Compresses it with gzip
3. Uploads to S3 (if configured)
4. Stores locally in backups/ directory
5. Cleans up old backups based on retention policy
"""

import argparse
import gzip
import subprocess
import sys
from datetime import datetime, timedelta
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import settings


def create_backup(output_path: Path) -> bool:
    """Create a PostgreSQL dump and compress it.

    Args:
        output_path: Path to save the compressed backup

    Returns:
        True if successful, False otherwise
    """
    print(f"Creating database backup: {output_path}")

    # Parse DATABASE_URL to get connection params
    db_url = settings.DATABASE_URL
    if not db_url:
        print("❌ DATABASE_URL not configured")
        return False

    # Extract connection params from postgres://user:pass@host:port/dbname
    # Format: postgresql://user:password@host:port/database
    try:
        # Remove scheme
        url_parts = db_url.split("://")[1]
        # Split user:pass@host:port/db
        auth_and_host = url_parts.split("/")
        db_name = auth_and_host[1].split("?")[0]  # Remove query params
        user_pass_host = auth_and_host[0]

        # Split auth and host
        auth, host_port = user_pass_host.split("@")
        user, password = auth.split(":")

        # Split host and port
        if ":" in host_port:
            host, port = host_port.split(":")
        else:
            host = host_port
            port = "5432"

    except Exception as e:
        print(f"❌ Failed to parse DATABASE_URL: {e}")
        return False

    # Create pg_dump command
    env = {
        "PGPASSWORD": password,
    }

    cmd = [
        "pg_dump",
        "-h", host,
        "-p", port,
        "-U", user,
        "-d", db_name,
        "--format=custom",  # Custom format for faster restore
        "--compress=9",  # Maximum compression
        "--verbose",
    ]

    try:
        # Create backup directory if needed
        output_path.parent.mkdir(parents=True, exist_ok=True)

        # Run pg_dump
        print(f"Running: pg_dump -h {host} -p {port} -U {user} -d {db_name}")
        with open(output_path, "wb") as f:
            result = subprocess.run(
                cmd,
                env={**subprocess.os.environ, **env},
                stdout=f,
                stderr=subprocess.PIPE,
                check=True,
            )

        # Check file was created
        if output_path.exists() and output_path.stat().st_size > 0:
            size_mb = output_path.stat().st_size / (1024 * 1024)
            print(f"✅ Backup created: {output_path} ({size_mb:.2f} MB)")
            return True
        else:
            print("❌ Backup file is empty or missing")
            return False

    except subprocess.CalledProcessError as e:
        print(f"❌ pg_dump failed: {e.stderr.decode()}")
        return False
    except Exception as e:
        print(f"❌ Backup failed: {e}")
        return False


def upload_to_s3(backup_path: Path) -> bool:
    """Upload backup to S3/R2 storage.

    Args:
        backup_path: Path to the backup file

    Returns:
        True if successful, False otherwise
    """
    if not settings.S3_BUCKET_NAME:
        print("⚠️  S3 not configured, skipping upload")
        return False

    print(f"Uploading to S3: {settings.S3_BUCKET_NAME}/backups/{backup_path.name}")

    try:
        from app.services.storage import upload_file

        with open(backup_path, "rb") as f:
            backup_bytes = f.read()

        storage_key = f"backups/{backup_path.name}"
        upload_file(
            backup_bytes,
            storage_key,
            content_type="application/x-postgresql-dump",
        )

        print(f"✅ Uploaded to S3: {storage_key}")
        return True

    except Exception as e:
        print(f"❌ S3 upload failed: {e}")
        return False


def cleanup_old_backups(backup_dir: Path, keep_days: int):
    """Remove backups older than keep_days.

    Args:
        backup_dir: Directory containing backups
        keep_days: Number of days to retain backups
    """
    if not backup_dir.exists():
        return

    cutoff = datetime.now() - timedelta(days=keep_days)
    print(f"Cleaning up backups older than {keep_days} days ({cutoff.date()})")

    deleted = 0
    for backup_file in backup_dir.glob("foiapipe_backup_*.dump"):
        # Get file modification time
        mtime = datetime.fromtimestamp(backup_file.stat().st_mtime)

        if mtime < cutoff:
            size_mb = backup_file.stat().st_size / (1024 * 1024)
            print(f"  Deleting: {backup_file.name} ({size_mb:.2f} MB, {mtime.date()})")
            backup_file.unlink()
            deleted += 1

    if deleted > 0:
        print(f"✅ Deleted {deleted} old backup(s)")
    else:
        print("✅ No old backups to delete")


def main():
    """Run the backup process."""
    parser = argparse.ArgumentParser(description="Backup FOIAPIPE database")
    parser.add_argument(
        "--local-only",
        action="store_true",
        help="Only save locally, skip S3 upload",
    )
    parser.add_argument(
        "--s3-only",
        action="store_true",
        help="Only upload to S3, skip local save",
    )
    parser.add_argument(
        "--keep-days",
        type=int,
        default=7,
        help="Number of days to keep old backups (default: 7)",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path(__file__).resolve().parent.parent / "backups",
        help="Directory to save backups (default: backend/backups/)",
    )

    args = parser.parse_args()

    if args.local_only and args.s3_only:
        print("❌ Cannot use both --local-only and --s3-only")
        return 1

    print("=" * 80)
    print("FOIAPIPE DATABASE BACKUP")
    print(f"Started: {datetime.now().isoformat()}")
    print("=" * 80)

    # Generate backup filename with timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_filename = f"foiapipe_backup_{timestamp}.dump"
    backup_path = args.output_dir / backup_filename

    # Create backup
    if not create_backup(backup_path):
        print("\n❌ BACKUP FAILED")
        return 1

    # Upload to S3 (unless --local-only)
    s3_success = True
    if not args.local_only:
        s3_success = upload_to_s3(backup_path)

    # Remove local file if --s3-only and upload succeeded
    if args.s3_only and s3_success:
        print(f"Removing local backup (--s3-only): {backup_path}")
        backup_path.unlink()

    # Cleanup old backups (only if keeping local backups)
    if not args.s3_only:
        cleanup_old_backups(args.output_dir, args.keep_days)

    print("\n" + "=" * 80)
    print("BACKUP SUMMARY")
    print("=" * 80)
    print(f"Database backup:     ✅ SUCCESS")

    if not args.local_only:
        print(f"S3 upload:          {'✅ SUCCESS' if s3_success else '❌ FAILED'}")

    if not args.s3_only:
        print(f"Local backup:        {backup_path}")

    print("=" * 80)

    return 0


if __name__ == "__main__":
    sys.exit(main())
