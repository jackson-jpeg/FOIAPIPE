"""Videos router – CRUD, file upload, thumbnail generation, and pipeline counts."""

from __future__ import annotations

import os
import tempfile
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.foia_request import FoiaRequest
from app.models.video import Video, VideoStatus
from app.schemas.video import (
    VideoCreate,
    VideoList,
    VideoPipelineCounts,
    VideoResponse,
    VideoUpdate,
)
from app.services.storage import upload_file
from app.services.video_processor import (
    extract_metadata,
    generate_thumbnail as ffmpeg_generate_thumbnail,
)
from app.services.subtitle_generator import (
    STTProvider,
    SubtitleFormat,
    generate_subtitles,
    validate_subtitle_file,
)
from app.models.video_subtitle import VideoSubtitle

router = APIRouter(prefix="/api/videos", tags=["videos"])


# ── Helpers ──────────────────────────────────────────────────────────────


def _to_response(video: Video) -> VideoResponse:
    """Convert a Video ORM instance to the API response schema."""
    foia_case_number = None
    if video.foia_request:
        foia_case_number = video.foia_request.case_number
    return VideoResponse(
        id=video.id,
        title=video.title,
        description=video.description,
        tags=video.tags,
        foia_request_id=video.foia_request_id,
        foia_case_number=foia_case_number,
        status=video.status,
        raw_storage_key=video.raw_storage_key,
        processed_storage_key=video.processed_storage_key,
        thumbnail_storage_key=video.thumbnail_storage_key,
        duration_seconds=video.duration_seconds,
        resolution=video.resolution,
        file_size_bytes=video.file_size_bytes,
        youtube_video_id=video.youtube_video_id,
        youtube_url=video.youtube_url,
        youtube_upload_status=video.youtube_upload_status,
        visibility=video.visibility,
        editing_notes=video.editing_notes,
        priority=video.priority,
        published_at=video.published_at,
        created_at=video.created_at,
        updated_at=video.updated_at,
    )


# ── Pipeline counts (registered before /{video_id} to avoid conflicts) ──


@router.get("/pipeline-counts", response_model=VideoPipelineCounts)
async def pipeline_counts(
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> VideoPipelineCounts:
    """Return counts of videos grouped by status for Kanban headers."""
    rows = (
        await db.execute(
            select(Video.status, func.count(Video.id)).group_by(Video.status)
        )
    ).all()
    counts: dict[str, int] = {row[0].value: row[1] for row in rows}
    # Ensure every status key is present
    for s in VideoStatus:
        counts.setdefault(s.value, 0)
    return VideoPipelineCounts(counts=counts)


# ── List & Detail ────────────────────────────────────────────────────────


@router.get("", response_model=VideoList)
async def list_videos(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=200, description="Items per page"),
    status_filter: VideoStatus | None = Query(None, alias="status", description="Filter by status"),
    foia_request_id: uuid.UUID | None = Query(None, description="Filter by linked FOIA request"),
    has_youtube_id: bool | None = Query(None, description="Filter by YouTube publish status"),
    sort_by: str = Query("created_at", description="Sort field"),
    sort_dir: str = Query("desc", description="Sort direction: asc or desc"),
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> VideoList:
    """Return a paginated list of videos with filters."""
    stmt = select(Video)
    count_stmt = select(func.count(Video.id))

    # Apply filters
    if status_filter is not None:
        stmt = stmt.where(Video.status == status_filter)
        count_stmt = count_stmt.where(Video.status == status_filter)
    if foia_request_id is not None:
        stmt = stmt.where(Video.foia_request_id == foia_request_id)
        count_stmt = count_stmt.where(Video.foia_request_id == foia_request_id)
    if has_youtube_id is not None:
        if has_youtube_id:
            stmt = stmt.where(Video.youtube_video_id.isnot(None))
            count_stmt = count_stmt.where(Video.youtube_video_id.isnot(None))
        else:
            stmt = stmt.where(Video.youtube_video_id.is_(None))
            count_stmt = count_stmt.where(Video.youtube_video_id.is_(None))

    # Sort
    allowed_sort_fields = {
        "created_at": Video.created_at,
        "updated_at": Video.updated_at,
        "title": Video.title,
        "priority": Video.priority,
        "duration_seconds": Video.duration_seconds,
        "published_at": Video.published_at,
    }
    sort_column = allowed_sort_fields.get(sort_by, Video.created_at)
    if sort_dir.lower() == "asc":
        stmt = stmt.order_by(sort_column.asc().nullslast())
    else:
        stmt = stmt.order_by(sort_column.desc().nullslast())

    # Pagination
    offset = (page - 1) * page_size
    stmt = stmt.offset(offset).limit(page_size)

    total = (await db.execute(count_stmt)).scalar_one()
    result = await db.execute(stmt)
    videos = result.scalars().all()

    return VideoList(
        items=[_to_response(v) for v in videos],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{video_id}", response_model=VideoResponse)
async def get_video(
    video_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> VideoResponse:
    """Return full detail of a single video."""
    video = await db.get(Video, video_id)
    if not video:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Video not found"
        )
    return _to_response(video)


# ── Create & Update ─────────────────────────────────────────────────────


@router.post("", response_model=VideoResponse, status_code=status.HTTP_201_CREATED)
async def create_video(
    body: VideoCreate,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> VideoResponse:
    """Create a new video record, optionally linked to a FOIA request."""
    # Validate FOIA request exists if provided
    if body.foia_request_id:
        foia = await db.get(FoiaRequest, body.foia_request_id)
        if not foia:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="FOIA request not found",
            )

    video = Video(
        title=body.title,
        description=body.description,
        foia_request_id=body.foia_request_id,
        status=VideoStatus.raw_received,
    )
    db.add(video)
    await db.flush()
    await db.refresh(video)
    return _to_response(video)


@router.patch("/{video_id}", response_model=VideoResponse)
async def update_video(
    video_id: uuid.UUID,
    body: VideoUpdate,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> VideoResponse:
    """Update a video's mutable fields."""
    video = await db.get(Video, video_id)
    if not video:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Video not found"
        )
    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(video, field, value)
    await db.flush()
    await db.refresh(video)
    return _to_response(video)


# ── File Upload ──────────────────────────────────────────────────────────


@router.post("/{video_id}/upload-raw", response_model=VideoResponse)
async def upload_raw_video(
    video_id: uuid.UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> VideoResponse:
    """Upload raw video file, extract metadata with ffprobe, store in S3."""
    video = await db.get(Video, video_id)
    if not video:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Video not found"
        )

    # Read the uploaded file
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Empty file"
        )

    # Write to a temp file for ffprobe metadata extraction
    suffix = os.path.splitext(file.filename or "video.mp4")[1] or ".mp4"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(file_bytes)
        tmp_path = tmp.name

    try:
        # Extract metadata
        metadata = await extract_metadata(tmp_path)
    except RuntimeError:
        # If ffprobe fails (not installed, corrupt file, etc.), proceed without metadata
        metadata = {}
    finally:
        os.unlink(tmp_path)

    # Upload to S3/R2
    storage_key = f"videos/raw/{video_id}{suffix}"
    content_type = file.content_type or "video/mp4"
    upload_file(file_bytes, storage_key, content_type)

    # Update video record
    video.raw_storage_key = storage_key
    video.file_size_bytes = len(file_bytes)
    if metadata.get("duration_seconds"):
        video.duration_seconds = metadata["duration_seconds"]
    if metadata.get("resolution"):
        video.resolution = metadata["resolution"]

    await db.flush()
    await db.refresh(video)
    return _to_response(video)


# ── Thumbnail Generation ─────────────────────────────────────────────────


@router.post("/{video_id}/generate-thumbnail", response_model=VideoResponse)
async def generate_video_thumbnail(
    video_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> VideoResponse:
    """Generate a thumbnail from the raw video and store it in S3."""
    video = await db.get(Video, video_id)
    if not video:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Video not found"
        )

    if not video.raw_storage_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No raw video uploaded. Upload a video first.",
        )

    # Download the raw video from S3 to a temp file
    from app.services.storage import download_file

    raw_bytes = download_file(video.raw_storage_key)

    suffix = os.path.splitext(video.raw_storage_key)[1] or ".mp4"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp_video:
        tmp_video.write(raw_bytes)
        tmp_video_path = tmp_video.name

    thumb_path = tmp_video_path + ".thumb.jpg"

    try:
        # Pick a timestamp ~10% into the video, default 5s
        timestamp = min(5, (video.duration_seconds or 30) // 10)
        await ffmpeg_generate_thumbnail(tmp_video_path, thumb_path, timestamp=timestamp)

        # Read thumbnail and upload to S3
        with open(thumb_path, "rb") as f:
            thumb_bytes = f.read()

        thumb_key = f"videos/thumbnails/{video_id}.jpg"
        upload_file(thumb_bytes, thumb_key, "image/jpeg")

        video.thumbnail_storage_key = thumb_key
        await db.flush()
        await db.refresh(video)
    finally:
        # Cleanup temp files
        if os.path.exists(tmp_video_path):
            os.unlink(tmp_video_path)
        if os.path.exists(thumb_path):
            os.unlink(thumb_path)

    return _to_response(video)


# ── Subtitle Generation ──────────────────────────────────────────────────


@router.post("/{video_id}/generate-subtitles")
async def generate_video_subtitles(
    video_id: uuid.UUID,
    language: str = Query("en", description="Language code (ISO 639-1)"),
    subtitle_format: SubtitleFormat = Query(SubtitleFormat.srt, description="Subtitle format"),
    provider: STTProvider = Query(STTProvider.mock, description="Speech-to-text provider"),
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> dict:
    """Generate subtitles for a video using speech-to-text.

    Supports multiple STT providers and subtitle formats.

    NOTE: Whisper provider requires OPENAI_API_KEY environment variable.
    Use 'mock' provider for testing without API key.
    """
    video = await db.get(Video, video_id)
    if not video:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Video not found",
        )

    if not video.storage_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Video file not uploaded yet",
        )

    try:
        # Download video from S3 to temp file
        from app.services.storage import download_file

        video_bytes = download_file(video.storage_key)

        # Save to temp file
        with tempfile.NamedTemporaryFile(
            delete=False, suffix=".mp4"
        ) as tmp_video:
            tmp_video.write(video_bytes)
            tmp_video_path = tmp_video.name

        # Generate subtitles
        subtitle_path = await generate_subtitles(
            video_file_path=tmp_video_path,
            subtitle_format=subtitle_format,
            provider=provider,
            language=language,
        )

        # Validate subtitle file
        validation = validate_subtitle_file(subtitle_path)

        if not validation.get("valid"):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Subtitle validation failed: {validation.get('error')}",
            )

        # Upload to S3
        with open(subtitle_path, "rb") as f:
            subtitle_bytes = f.read()

        subtitle_key = f"videos/subtitles/{video_id}_{language}.{subtitle_format.value}"
        upload_file(subtitle_bytes, subtitle_key, "text/plain; charset=utf-8")

        # Save subtitle record
        subtitle_record = VideoSubtitle(
            video_id=video_id,
            language=language,
            format=subtitle_format.value,
            storage_key=subtitle_key,
            provider=provider.value,
            segment_count=validation.get("segment_count"),
            file_size_bytes=validation.get("file_size_bytes"),
        )
        db.add(subtitle_record)
        await db.flush()
        await db.refresh(subtitle_record)

        # Cleanup temp files
        os.unlink(tmp_video_path)
        os.unlink(subtitle_path)

        return {
            "success": True,
            "subtitle_id": str(subtitle_record.id),
            "language": language,
            "format": subtitle_format.value,
            "storage_key": subtitle_key,
            "segment_count": validation.get("segment_count"),
            "file_size_bytes": validation.get("file_size_bytes"),
            "provider": provider.value,
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Subtitle generation failed: {str(e)}",
        )


@router.get("/{video_id}/subtitles")
async def list_video_subtitles(
    video_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> dict:
    """List all subtitles for a video."""
    video = await db.get(Video, video_id)
    if not video:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Video not found",
        )

    # Get subtitles
    result = await db.execute(
        select(VideoSubtitle)
        .where(VideoSubtitle.video_id == video_id)
        .order_by(VideoSubtitle.language)
    )
    subtitles = result.scalars().all()

    return {
        "video_id": str(video_id),
        "subtitle_count": len(subtitles),
        "subtitles": [
            {
                "id": str(sub.id),
                "language": sub.language,
                "format": sub.format,
                "storage_key": sub.storage_key,
                "provider": sub.provider,
                "segment_count": sub.segment_count,
                "file_size_bytes": sub.file_size_bytes,
                "created_at": sub.created_at.isoformat() if sub.created_at else None,
            }
            for sub in subtitles
        ],
    }


@router.delete("/{video_id}/subtitles/{subtitle_id}")
async def delete_video_subtitle(
    video_id: uuid.UUID,
    subtitle_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> dict:
    """Delete a subtitle track from a video."""
    subtitle = await db.get(VideoSubtitle, subtitle_id)
    if not subtitle or subtitle.video_id != str(video_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subtitle not found",
        )

    # Delete from S3 if exists
    if subtitle.storage_key:
        try:
            from app.services.storage import delete_file

            delete_file(subtitle.storage_key)
        except Exception:
            pass  # Continue even if S3 deletion fails

    # Delete from database
    await db.delete(subtitle)
    await db.flush()

    return {
        "success": True,
        "message": f"Subtitle {subtitle.language}/{subtitle.format} deleted",
    }
