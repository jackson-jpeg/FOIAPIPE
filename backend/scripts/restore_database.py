#!/usr/bin/env python3
"""Database restore script from local or S3 backup.

Usage:
    # Restore from local file
    python scripts/restore_database.py backups/foiaarchive_backup_20260209_120000.dump

    # Restore from S3
    python scripts/restore_database.py --from-s3 backups/foiaarchive_backup_20260209_120000.dump

    # List available backups
    python scripts/restore_database.py --list

DANGER: This will DROP and RECREATE the database! Make sure you have a backup first.
"""

import argparse
import subprocess
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import settings


def list_local_backups(backup_dir: Path):
    """List all local backups with sizes and dates."""
    if not backup_dir.exists():
        print(f"❌ Backup directory does not exist: {backup_dir}")
        return

    backups = sorted(backup_dir.glob("foiaarchive_backup_*.dump"), reverse=True)

    if not backups:
        print(f"No backups found in {backup_dir}")
        return

    print(f"\nAvailable local backups ({backup_dir}):")
    print("-" * 80)

    for backup in backups:
        size_mb = backup.stat().st_size / (1024 * 1024)
        mtime = backup.stat().st_mtime
        from datetime import datetime
        date_str = datetime.fromtimestamp(mtime).strftime("%Y-%m-%d %H:%M:%S")

        print(f"  {backup.name}")
        print(f"    Size: {size_mb:.2f} MB")
        print(f"    Date: {date_str}")
        print()


def list_s3_backups():
    """List all backups in S3."""
    if not settings.S3_BUCKET_NAME:
        print("❌ S3 not configured")
        return

    print(f"\nListing backups in S3: {settings.S3_BUCKET_NAME}/backups/")
    print("-" * 80)

    try:
        import boto3

        s3 = boto3.client(
            "s3",
            endpoint_url=settings.S3_ENDPOINT,
            aws_access_key_id=settings.S3_ACCESS_KEY,
            aws_secret_access_key=settings.S3_SECRET_KEY,
            region_name=settings.S3_REGION or "auto",
        )

        response = s3.list_objects_v2(
            Bucket=settings.S3_BUCKET_NAME,
            Prefix="backups/",
        )

        if "Contents" not in response:
            print("No backups found in S3")
            return

        # Sort by date (newest first)
        objects = sorted(
            response["Contents"],
            key=lambda x: x["LastModified"],
            reverse=True,
        )

        for obj in objects:
            if obj["Key"].endswith(".dump"):
                size_mb = obj["Size"] / (1024 * 1024)
                date_str = obj["LastModified"].strftime("%Y-%m-%d %H:%M:%S")

                print(f"  {obj['Key']}")
                print(f"    Size: {size_mb:.2f} MB")
                print(f"    Date: {date_str}")
                print()

    except Exception as e:
        print(f"❌ Failed to list S3 backups: {e}")


def download_from_s3(s3_key: str, local_path: Path) -> bool:
    """Download a backup from S3.

    Args:
        s3_key: S3 object key (e.g., "backups/foiaarchive_backup_20260209_120000.dump")
        local_path: Where to save the downloaded file

    Returns:
        True if successful, False otherwise
    """
    if not settings.S3_BUCKET_NAME:
        print("❌ S3 not configured")
        return False

    print(f"Downloading from S3: {s3_key}")

    try:
        from app.services.storage import download_file

        backup_bytes = download_file(s3_key)

        # Save to local file
        local_path.parent.mkdir(parents=True, exist_ok=True)
        with open(local_path, "wb") as f:
            f.write(backup_bytes)

        size_mb = len(backup_bytes) / (1024 * 1024)
        print(f"✅ Downloaded: {local_path} ({size_mb:.2f} MB)")
        return True

    except Exception as e:
        print(f"❌ Download failed: {e}")
        return False


def restore_backup(backup_path: Path) -> bool:
    """Restore database from a pg_dump file.

    Args:
        backup_path: Path to the backup file

    Returns:
        True if successful, False otherwise
    """
    print(f"\n⚠️  DANGER: This will REPLACE the current database with the backup!")
    print(f"Backup file: {backup_path}")

    # Require explicit confirmation
    response = input("\nType 'YES' to continue: ")
    if response != "YES":
        print("❌ Restore cancelled")
        return False

    # Parse DATABASE_URL
    db_url = settings.DATABASE_URL
    if not db_url:
        print("❌ DATABASE_URL not configured")
        return False

    try:
        # Extract connection params
        url_parts = db_url.split("://")[1]
        auth_and_host = url_parts.split("/")
        db_name = auth_and_host[1].split("?")[0]
        user_pass_host = auth_and_host[0]

        auth, host_port = user_pass_host.split("@")
        user, password = auth.split(":")

        if ":" in host_port:
            host, port = host_port.split(":")
        else:
            host = host_port
            port = "5432"

    except Exception as e:
        print(f"❌ Failed to parse DATABASE_URL: {e}")
        return False

    env = {"PGPASSWORD": password}

    # Drop existing database (pg_restore can't do this directly)
    print("\n1. Dropping existing database connections...")
    terminate_cmd = [
        "psql",
        "-h", host,
        "-p", port,
        "-U", user,
        "-d", "postgres",  # Connect to postgres db
        "-c", f"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '{db_name}' AND pid != pg_backend_pid();",
    ]

    try:
        subprocess.run(
            terminate_cmd,
            env={**subprocess.os.environ, **env},
            check=True,
            capture_output=True,
        )
        print("✅ Terminated existing connections")
    except subprocess.CalledProcessError as e:
        print(f"⚠️  Warning: Could not terminate connections: {e.stderr.decode()}")

    # Drop database
    print(f"\n2. Dropping database: {db_name}")
    drop_cmd = [
        "psql",
        "-h", host,
        "-p", port,
        "-U", user,
        "-d", "postgres",
        "-c", f"DROP DATABASE IF EXISTS {db_name};",
    ]

    try:
        subprocess.run(
            drop_cmd,
            env={**subprocess.os.environ, **env},
            check=True,
            capture_output=True,
        )
        print("✅ Database dropped")
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to drop database: {e.stderr.decode()}")
        return False

    # Create fresh database
    print(f"\n3. Creating fresh database: {db_name}")
    create_cmd = [
        "psql",
        "-h", host,
        "-p", port,
        "-U", user,
        "-d", "postgres",
        "-c", f"CREATE DATABASE {db_name};",
    ]

    try:
        subprocess.run(
            create_cmd,
            env={**subprocess.os.environ, **env},
            check=True,
            capture_output=True,
        )
        print("✅ Database created")
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to create database: {e.stderr.decode()}")
        return False

    # Restore from backup
    print(f"\n4. Restoring from backup: {backup_path}")
    restore_cmd = [
        "pg_restore",
        "-h", host,
        "-p", port,
        "-U", user,
        "-d", db_name,
        "--verbose",
        "--no-owner",  # Don't restore ownership
        "--no-acl",  # Don't restore ACLs
        str(backup_path),
    ]

    try:
        result = subprocess.run(
            restore_cmd,
            env={**subprocess.os.environ, **env},
            stderr=subprocess.PIPE,
            check=True,
        )
        print("✅ Database restored successfully")
        return True

    except subprocess.CalledProcessError as e:
        print(f"❌ Restore failed: {e.stderr.decode()}")
        return False


def main():
    """Run the restore process."""
    parser = argparse.ArgumentParser(description="Restore FOIA Archive database from backup")
    parser.add_argument(
        "backup_file",
        nargs="?",
        help="Backup file to restore (local path or S3 key)",
    )
    parser.add_argument(
        "--from-s3",
        action="store_true",
        help="Download backup from S3 first",
    )
    parser.add_argument(
        "--list",
        action="store_true",
        help="List available backups",
    )
    parser.add_argument(
        "--list-s3",
        action="store_true",
        help="List backups in S3",
    )
    parser.add_argument(
        "--backup-dir",
        type=Path,
        default=Path(__file__).resolve().parent.parent / "backups",
        help="Directory containing backups (default: backend/backups/)",
    )

    args = parser.parse_args()

    # List mode
    if args.list:
        list_local_backups(args.backup_dir)
        return 0

    if args.list_s3:
        list_s3_backups()
        return 0

    # Restore mode
    if not args.backup_file:
        parser.print_help()
        return 1

    print("=" * 80)
    print("FOIA ARCHIVE DATABASE RESTORE")
    print("=" * 80)

    # Handle S3 download
    if args.from_s3:
        # Download from S3 to temp location
        temp_path = args.backup_dir / Path(args.backup_file).name
        if not download_from_s3(args.backup_file, temp_path):
            return 1
        backup_path = temp_path
    else:
        # Use local file
        backup_path = Path(args.backup_file)
        if not backup_path.is_absolute():
            backup_path = args.backup_dir / backup_path

        if not backup_path.exists():
            print(f"❌ Backup file not found: {backup_path}")
            return 1

    # Restore
    if restore_backup(backup_path):
        print("\n" + "=" * 80)
        print("✅ RESTORE COMPLETE")
        print("=" * 80)
        return 0
    else:
        print("\n" + "=" * 80)
        print("❌ RESTORE FAILED")
        print("=" * 80)
        return 1


if __name__ == "__main__":
    sys.exit(main())
