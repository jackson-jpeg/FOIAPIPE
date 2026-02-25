"""Maintenance tasks for system cleanup and health monitoring."""

import asyncio
import logging
from datetime import datetime, timedelta

from app.services.cleanup_service import CleanupService
from app.services.audit_logger import AuditLogger

logger = logging.getLogger(__name__)
cleanup_service = CleanupService()


@celery_app.task(bind=True, max_retries=3)
def cleanup_temporary_files(self) -> dict:
    """Clean up expired temporary files and manage disk space."""
    try:
        logger.info("Starting temporary file cleanup task")
        
        # Get cleanup report
        report = asyncio.run(cleanup_service.get_cleanup_report())
        logger.info(f"Pre-cleanup report: {report}")
        
        # Clean up expired files
        expired_result = asyncio.run(cleanup_service.cleanup_expired_files())
        
        # Clean up by disk space if needed
        space_result = asyncio.run(cleanup_service.cleanup_by_disk_space())
        
        total_deleted = expired_result["deleted_files"] + space_result["deleted_files"]
        total_freed = expired_result["freed_space_mb"] + space_result["freed_space_mb"]
        
        result = {
            "task": "cleanup_temporary_files",
            "completed_at": datetime.utcnow().isoformat(),
            "expired_files_deleted": expired_result["deleted_files"],
            "space_cleanup_files_deleted": space_result["deleted_files"],
            "total_files_deleted": total_deleted,
            "total_space_freed_mb": total_freed,
            "disk_usage_after": asyncio.run(cleanup_service.get_cleanup_report())["disk_usage"]
        }
        
        # Log to audit
        AuditLogger.log_system_event(
            event_type="cleanup",
            description=f"Cleaned up {total_deleted} files, freed {total_freed} MB",
            metadata=result
        )
        
        logger.info(f"Cleanup completed: {result}")
        return result
        
    except Exception as exc:
        logger.error(f"Cleanup task failed: {exc}")
        
        # Log failure to audit
        AuditLogger.log_system_event(
            event_type="cleanup_failed",
            description=f"Temporary file cleanup failed: {str(exc)}",
            metadata={"error": str(exc)}
        )
        
        raise self.retry(exc=exc, countdown=300)


@celery_app.task
def get_cleanup_status() -> dict:
    """Get current cleanup status and disk usage."""
    try:
        report = asyncio.run(cleanup_service.get_cleanup_report())
        return {
            "status": "healthy",
            "report": report,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Failed to get cleanup status: {e}")
        return {
            "status": "error",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }