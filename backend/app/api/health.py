"""Health check endpoints including storage and cleanup status."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.services.cleanup_service import CleanupService

router = APIRouter()


@router.get("/health/storage")
async def storage_health(db: AsyncSession = Depends(get_db)):
    """Check storage health and cleanup status."""
    cleanup_service = CleanupService()
    report = await cleanup_service.get_cleanup_report()
    
    return {
        "status": "ok",
        "storage": {
            "disk_usage": report["disk_usage"],
            "expired_files": report["expired_files_count"],
            "large_files": report["large_files_count"],
            "temp_directories": report["temp_directories"]
        }
    }


@router.post("/admin/cleanup", tags=["admin"])
async def trigger_cleanup():
    """Manually trigger temporary file cleanup (admin only)."""
    from app.tasks.maintenance_tasks import cleanup_temporary_files
    
    task = cleanup_temporary_files.delay()
    return {"message": "Cleanup task started", "task_id": task.id}