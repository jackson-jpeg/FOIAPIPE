"""Service for automated cleanup of temporary files and storage management."""

import asyncio
import logging
import os
import shutil
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Tuple

from app.config import settings

logger = logging.getLogger(__name__)


class CleanupService:
    """Service for managing temporary file cleanup and disk space monitoring."""
    
    def __init__(self):
        self.temp_dirs = [
            Path(settings.LOCAL_STORAGE_PATH) / "temp",
            Path(settings.LOCAL_STORAGE_PATH) / "processing",
            Path(settings.LOCAL_STORAGE_PATH) / "uploads",
        ]
        
    def get_disk_usage(self) -> Dict[str, float]:
        """Get current disk usage statistics."""
        try:
            stat = shutil.disk_usage(settings.LOCAL_STORAGE_PATH)
            return {
                "total_gb": stat.total / (1024**3),
                "used_gb": stat.used / (1024**3),
                "free_gb": stat.free / (1024**3),
                "usage_percent": (stat.used / stat.total) * 100
            }
        except Exception as e:
            logger.error(f"Failed to get disk usage: {e}")
            return {}
    
    def find_expired_files(self, retention_hours: int = None) -> List[Path]:
        """Find files older than retention period."""
        if retention_hours is None:
            retention_hours = settings.TEMP_FILE_RETENTION_HOURS
            
        cutoff_time = datetime.now() - timedelta(hours=retention_hours)
        expired_files = []
        
        for temp_dir in self.temp_dirs:
            if not temp_dir.exists():
                continue
                
            for file_path in temp_dir.rglob("*"):
                if file_path.is_file():
                    try:
                        mtime = datetime.fromtimestamp(file_path.stat().st_mtime)
                        if mtime < cutoff_time:
                            expired_files.append(file_path)
                    except Exception as e:
                        logger.warning(f"Could not check file {file_path}: {e}")
        
        return expired_files
    
    def find_large_files(self, min_size_mb: int = 100) -> List[Tuple[Path, float]]:
        """Find files larger than specified size."""
        large_files = []
        min_size_bytes = min_size_mb * 1024 * 1024
        
        for temp_dir in self.temp_dirs:
            if not temp_dir.exists():
                continue
                
            for file_path in temp_dir.rglob("*"):
                if file_path.is_file():
                    try:
                        size = file_path.stat().st_size
                        if size > min_size_bytes:
                            large_files.append((file_path, size / (1024**2)))
                    except Exception as e:
                        logger.warning(f"Could not check file size {file_path}: {e}")
        
        return sorted(large_files, key=lambda x: x[1], reverse=True)
    
    async def cleanup_expired_files(self, retention_hours: int = None) -> Dict[str, int]:
        """Clean up expired temporary files."""
        expired_files = self.find_expired_files(retention_hours)
        
        deleted_count = 0
        total_size_mb = 0
        
        for file_path in expired_files:
            try:
                size_mb = file_path.stat().st_size / (1024**2)
                file_path.unlink()
                deleted_count += 1
                total_size_mb += size_mb
                logger.info(f"Deleted expired file: {file_path} ({size_mb:.1f} MB)")
            except Exception as e:
                logger.error(f"Failed to delete {file_path}: {e}")
        
        # Clean up empty directories
        for temp_dir in self.temp_dirs:
            if temp_dir.exists():
                self._cleanup_empty_dirs(temp_dir)
        
        return {
            "deleted_files": deleted_count,
            "freed_space_mb": int(total_size_mb)
        }
    
    async def cleanup_by_disk_space(self) -> Dict[str, int]:
        """Clean up files when disk space is low."""
        disk_usage = self.get_disk_usage()
        
        if not disk_usage:
            return {"deleted_files": 0, "freed_space_mb": 0}
        
        usage_percent = disk_usage["usage_percent"]
        free_gb = disk_usage["free_gb"]
        
        if usage_percent < settings.MAX_DISK_USAGE_PERCENT and free_gb > settings.MIN_FREE_SPACE_GB:
            logger.info("Disk space is healthy, skipping cleanup")
            return {"deleted_files": 0, "freed_space_mb": 0}
        
        logger.warning(f"Disk space low: {usage_percent:.1f}% used, {free_gb:.1f} GB free")
        
        # Find files to delete, starting with largest
        large_files = self.find_large_files()
        
        deleted_count = 0
        total_size_mb = 0
        target_free_mb = settings.MIN_FREE_SPACE_GB * 1024
        
        for file_path, size_mb in large_files:
            if total_size_mb >= target_free_mb:
                break
                
            try:
                file_path.unlink()
                deleted_count += 1
                total_size_mb += size_mb
                logger.info(f"Deleted large file: {file_path} ({size_mb:.1f} MB)")
            except Exception as e:
                logger.error(f"Failed to delete {file_path}: {e}")
        
        return {
            "deleted_files": deleted_count,
            "freed_space_mb": int(total_size_mb)
        }
    
    def _cleanup_empty_dirs(self, directory: Path) -> None:
        """Remove empty directories recursively."""
        try:
            for dir_path in directory.rglob("*"):
                if dir_path.is_dir() and not any(dir_path.iterdir()):
                    dir_path.rmdir()
                    logger.debug(f"Removed empty directory: {dir_path}")
        except Exception as e:
            logger.debug(f"Could not cleanup empty directories: {e}")
    
    async def get_cleanup_report(self) -> Dict[str, any]:
        """Generate a comprehensive cleanup report."""
        disk_usage = self.get_disk_usage()
        expired_files = self.find_expired_files()
        large_files = self.find_large_files()
        
        return {
            "disk_usage": disk_usage,
            "expired_files_count": len(expired_files),
            "large_files_count": len(large_files),
            "temp_directories": [str(d) for d in self.temp_dirs],
            "retention_hours": settings.TEMP_FILE_RETENTION_HOURS,
            "max_disk_usage_percent": settings.MAX_DISK_USAGE_PERCENT,
            "min_free_space_gb": settings.MIN_FREE_SPACE_GB
        }