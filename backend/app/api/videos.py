"""Videos router – CRUD, file upload, thumbnail generation, subtitle generation, and pipeline counts.

Provides comprehensive video management including:
- CRUD operations for video metadata
- Raw video file upload with automatic metadata extraction
- Thumbnail generation using FFmpeg
- Subtitle generation using multiple STT providers
- Pipeline status tracking and counts
"""

from __future__ import annotations

import logging
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
    trim_video as ffmpeg_trim,
    add_intro_card as ffmpeg_intro_card,
    export_youtube_optimized as ffmpeg_yt_export,
    generate_youtube_thumbnail as ffmpeg_yt_thumbnail,
)
from app.services.subtitle_generator import (
    STTProvider,
    SubtitleFormat,
    generate_subtitles,
    validate_subtitle_file,
)
from app.models.video_subtitle import VideoSubtitle

router = APIRouter(prefix="/api/videos", tags=["videos"])
logger = logging.getLogger(__name__)


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
    """Get video counts grouped by status for Kanban board headers.

    Returns the count of videos in each status stage to power the frontend
    Kanban view and pipeline visualization.

    Args:
        db: Database session
        _user: Authenticated user

    Returns:
        Dict mapping each VideoStatus to its count (all statuses present even if 0)
    """
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
    """Upload raw video file to cloud storage with metadata extraction.

    Accepts a video file upload, extracts metadata using FFmpeg/ffprobe,
    uploads to S3/R2 storage, and updates the video record with file details.

    Args:
        video_id: UUID of the video record
        file: Uploaded video file
        db: Database session
        _user: Authenticated user

    Returns:
        Updated video record with storage key and metadata

    Raises:
        HTTPException: If video not found or file is empty

    Note:
        - Metadata extraction requires FFmpeg/ffprobe installed
        - If metadata extraction fails, file is still uploaded
        - Supports all common video formats (mp4, mov, avi, etc.)
    """
    logger.info(f"Uploading raw video for {video_id}: {file.filename}")

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

    logger.info(
        f"Raw video uploaded successfully for {video_id}: "
        f"{storage_key} ({len(file_bytes)} bytes, "
        f"{metadata.get('duration_seconds', 'unknown')}s)"
    )

    return _to_response(video)


# ── Thumbnail Generation ─────────────────────────────────────────────────


@router.post("/{video_id}/generate-thumbnail", response_model=VideoResponse)
async def generate_video_thumbnail(
    video_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> VideoResponse:
    """Generate a thumbnail image from the raw video using FFmpeg.

    Downloads the raw video, extracts a frame at ~10% into the video (min 5s),
    and uploads the thumbnail to cloud storage.

    Args:
        video_id: UUID of the video
        db: Database session
        _user: Authenticated user

    Returns:
        Updated video record with thumbnail_storage_key populated

    Raises:
        HTTPException: If video not found or no raw video uploaded

    Note:
        Requires FFmpeg installed on the system
    """
    logger.info(f"Generating thumbnail for video {video_id}")

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

        logger.info(f"Thumbnail generated successfully for video {video_id}: {thumb_key}")
    finally:
        # Cleanup temp files
        if os.path.exists(tmp_video_path):
            os.unlink(tmp_video_path)
        if os.path.exists(thumb_path):
            os.unlink(thumb_path)

    return _to_response(video)


# ── Video Processing ─────────────────────────────────────────────────────


@router.post("/{video_id}/trim")
async def trim_video(
    video_id: uuid.UUID,
    start: float = Query(..., ge=0, description="Start time in seconds"),
    end: float = Query(..., gt=0, description="End time in seconds"),
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> dict:
    """Trim a video to a segment. Stores result as the processed version."""
    video = await db.get(Video, video_id)
    if not video:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Video not found")

    storage_key = video.raw_storage_key
    if not storage_key:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No raw video uploaded")

    from app.services.storage import download_file

    raw_bytes = download_file(storage_key)
    suffix = os.path.splitext(storage_key)[1] or ".mp4"

    src_path = None
    out_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(raw_bytes)
            src_path = tmp.name
        out_path = src_path + f".trimmed{suffix}"

        await ffmpeg_trim(src_path, out_path, start, end)

        with open(out_path, "rb") as f:
            processed_bytes = f.read()

        processed_key = f"videos/processed/{video_id}_trimmed{suffix}"
        upload_file(processed_bytes, processed_key, "video/mp4")

        video.processed_storage_key = processed_key
        await db.flush()

        return {"success": True, "storage_key": processed_key, "message": f"Trimmed {start}s to {end}s"}
    finally:
        if src_path and os.path.exists(src_path):
            os.unlink(src_path)
        if out_path and os.path.exists(out_path):
            os.unlink(out_path)


@router.post("/{video_id}/add-intro")
async def add_intro(
    video_id: uuid.UUID,
    text: str = Query(..., description="Intro card text"),
    duration: int = Query(5, ge=1, le=15, description="Intro duration in seconds"),
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> dict:
    """Add a text intro card to the beginning of the video."""
    video = await db.get(Video, video_id)
    if not video:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Video not found")

    storage_key = video.processed_storage_key or video.raw_storage_key
    if not storage_key:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No video file in storage")

    from app.services.storage import download_file

    video_bytes = download_file(storage_key)
    suffix = os.path.splitext(storage_key)[1] or ".mp4"

    src_path = None
    out_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(video_bytes)
            src_path = tmp.name
        out_path = src_path + f".intro{suffix}"

        await ffmpeg_intro_card(src_path, out_path, text, duration)

        with open(out_path, "rb") as f:
            processed_bytes = f.read()

        processed_key = f"videos/processed/{video_id}_intro{suffix}"
        upload_file(processed_bytes, processed_key, "video/mp4")

        video.processed_storage_key = processed_key
        await db.flush()

        return {"success": True, "storage_key": processed_key, "message": f"Added {duration}s intro card"}
    finally:
        if src_path and os.path.exists(src_path):
            os.unlink(src_path)
        if out_path and os.path.exists(out_path):
            os.unlink(out_path)


@router.post("/{video_id}/optimize-youtube")
async def optimize_for_youtube(
    video_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> dict:
    """Re-encode video to H.264 1080p optimized for YouTube upload."""
    video = await db.get(Video, video_id)
    if not video:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Video not found")

    storage_key = video.processed_storage_key or video.raw_storage_key
    if not storage_key:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No video file in storage")

    from app.services.storage import download_file

    video_bytes = download_file(storage_key)

    src_path = None
    out_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
            tmp.write(video_bytes)
            src_path = tmp.name
        out_path = src_path + ".yt_optimized.mp4"

        await ffmpeg_yt_export(src_path, out_path)

        with open(out_path, "rb") as f:
            processed_bytes = f.read()

        processed_key = f"videos/processed/{video_id}_yt_optimized.mp4"
        upload_file(processed_bytes, processed_key, "video/mp4")

        video.processed_storage_key = processed_key
        await db.flush()

        metadata = await extract_metadata(out_path)
        return {"success": True, "storage_key": processed_key, "metadata": metadata}
    finally:
        if src_path and os.path.exists(src_path):
            os.unlink(src_path)
        if out_path and os.path.exists(out_path):
            os.unlink(out_path)


@router.post("/{video_id}/generate-youtube-thumbnail")
async def generate_yt_thumbnail(
    video_id: uuid.UUID,
    title_text: str = Query(None, description="Title text overlay"),
    agency_text: str = Query(None, description="Agency/date text overlay"),
    timestamp: int = Query(30, ge=0, description="Timestamp to extract frame"),
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> dict:
    """Generate a YouTube-style thumbnail with text overlays and gradient."""
    video = await db.get(Video, video_id)
    if not video:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Video not found")

    storage_key = video.processed_storage_key or video.raw_storage_key
    if not storage_key:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No video file in storage")

    from app.services.storage import download_file

    video_bytes = download_file(storage_key)

    src_path = None
    thumb_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
            tmp.write(video_bytes)
            src_path = tmp.name
        thumb_path = src_path + ".yt_thumb.jpg"

        title = title_text or video.title or "Bodycam Footage"
        agency = agency_text or ""

        await ffmpeg_yt_thumbnail(src_path, thumb_path, title, agency, timestamp)

        with open(thumb_path, "rb") as f:
            thumb_bytes = f.read()

        thumb_key = f"videos/thumbnails/{video_id}_yt.jpg"
        upload_file(thumb_bytes, thumb_key, "image/jpeg")

        video.thumbnail_storage_key = thumb_key
        await db.flush()

        return {"success": True, "storage_key": thumb_key}
    finally:
        if src_path and os.path.exists(src_path):
            os.unlink(src_path)
        if thumb_path and os.path.exists(thumb_path):
            os.unlink(thumb_path)


# ── YouTube Upload ───────────────────────────────────────────────────────


@router.post("/{video_id}/upload-youtube")
async def upload_to_youtube(
    video_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> dict:
    """Queue a video for upload to YouTube via Celery background task.

    The video must have a file in storage (raw or processed) and a title.
    Upload starts as a background task. Status is tracked in youtube_upload_status.
    """
    video = await db.get(Video, video_id)
    if not video:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Video not found")

    if not (video.processed_storage_key or video.raw_storage_key):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No video file in storage. Upload raw footage first.",
        )

    if video.youtube_video_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Video already uploaded to YouTube: {video.youtube_url}",
        )

    # Queue Celery task
    from app.tasks.youtube_tasks import upload_video as upload_task
    upload_task.delay(str(video.id))

    video.youtube_upload_status = "queued"
    await db.flush()

    return {
        "success": True,
        "message": f"Video '{video.title or video.id}' queued for YouTube upload",
        "video_id": str(video.id),
    }


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

    Supports multiple STT providers and subtitle formats. Downloads video from storage,
    generates subtitles using the selected provider, validates the output, and stores
    the subtitle file along with metadata.

    Args:
        video_id: UUID of the video to generate subtitles for
        language: Language code (ISO 639-1), default 'en'
        subtitle_format: Subtitle format (srt, vtt, ass)
        provider: Speech-to-text provider (whisper, google, azure, mock)
        db: Database session
        _user: Authenticated user

    Returns:
        Dict with subtitle info including storage location and metadata

    Raises:
        HTTPException: If video not found, no video file uploaded, or generation fails

    Note:
        - Whisper provider requires OPENAI_API_KEY environment variable
        - Use 'mock' provider for testing without API keys
        - Google and Azure providers require respective API credentials
    """
    video = await db.get(Video, video_id)
    if not video:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Video not found",
        )

    # Use processed video if available, otherwise raw
    storage_key = video.processed_storage_key or video.raw_storage_key
    if not storage_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No video file uploaded. Upload a raw or processed video first.",
        )

    tmp_video_path = None
    subtitle_path = None

    try:
        # Download video from S3 to temp file
        from app.services.storage import download_file

        logger.info(
            f"Generating {subtitle_format.value} subtitles for video {video_id} "
            f"in {language} using {provider.value}"
        )

        video_bytes = download_file(storage_key)

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

        logger.info(
            f"Subtitle generation successful: {subtitle_key} "
            f"({validation.get('segment_count')} segments, "
            f"{validation.get('file_size_bytes')} bytes)"
        )

        # Auto-upload to YouTube if video is published
        youtube_uploaded = False
        if video.youtube_video_id and subtitle_path:
            try:
                from app.services.subtitle_generator import upload_subtitles_to_youtube
                youtube_uploaded = await upload_subtitles_to_youtube(
                    video.youtube_video_id, subtitle_path, language
                )
            except Exception as e:
                logger.warning(f"Auto-upload subtitles to YouTube failed: {e}")

        return {
            "success": True,
            "subtitle_id": str(subtitle_record.id),
            "language": language,
            "format": subtitle_format.value,
            "storage_key": subtitle_key,
            "segment_count": validation.get("segment_count"),
            "file_size_bytes": validation.get("file_size_bytes"),
            "provider": provider.value,
            "youtube_uploaded": youtube_uploaded,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Subtitle generation failed for video {video_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Subtitle generation failed: {str(e)}",
        )
    finally:
        # Cleanup temp files
        if tmp_video_path and os.path.exists(tmp_video_path):
            os.unlink(tmp_video_path)
        if subtitle_path and os.path.exists(subtitle_path):
            os.unlink(subtitle_path)


@router.get("/{video_id}/subtitles")
async def list_video_subtitles(
    video_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> dict:
    """List all subtitle tracks for a video.

    Returns all subtitle files associated with the video, including metadata
    about language, format, storage location, and generation details.

    Args:
        video_id: UUID of the video
        db: Database session
        _user: Authenticated user

    Returns:
        Dict containing subtitle_count and list of subtitle records

    Raises:
        HTTPException: If video not found
    """
    video = await db.get(Video, video_id)
    if not video:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Video not found",
        )

    # Get subtitles ordered by language
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
    """Delete a subtitle track from a video.

    Removes both the subtitle file from storage and the database record.
    If storage deletion fails, continues to delete the database record.

    Args:
        video_id: UUID of the video
        subtitle_id: UUID of the subtitle to delete
        db: Database session
        _user: Authenticated user

    Returns:
        Success message with deleted subtitle info

    Raises:
        HTTPException: If subtitle not found or doesn't belong to the video
    """
    subtitle = await db.get(VideoSubtitle, subtitle_id)
    if not subtitle or str(subtitle.video_id) != str(video_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subtitle not found for this video",
        )

    subtitle_info = f"{subtitle.language}/{subtitle.format}"

    # Delete from S3 if exists
    if subtitle.storage_key:
        try:
            from app.services.storage import delete_file

            delete_file(subtitle.storage_key)
            logger.info(f"Deleted subtitle file from storage: {subtitle.storage_key}")
        except Exception as e:
            logger.warning(
                f"Failed to delete subtitle from storage: {subtitle.storage_key}, "
                f"error: {e}. Continuing with database deletion."
            )

    # Delete from database
    await db.delete(subtitle)
    await db.flush()

    logger.info(f"Deleted subtitle {subtitle_info} for video {video_id}")

    return {
        "success": True,
        "message": f"Subtitle {subtitle_info} deleted successfully",
    }


@router.post("/{video_id}/subtitles/{subtitle_id}/upload-youtube")
async def upload_subtitle_to_youtube(
    video_id: uuid.UUID,
    subtitle_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> dict:
    """Upload an existing subtitle track to YouTube."""
    video = await db.get(Video, video_id)
    if not video:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Video not found")
    if not video.youtube_video_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Video not uploaded to YouTube yet")

    subtitle = await db.get(VideoSubtitle, subtitle_id)
    if not subtitle or str(subtitle.video_id) != str(video_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subtitle not found for this video")

    if not subtitle.storage_key:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No subtitle file in storage")

    tmp_path = None
    try:
        from app.services.storage import download_file as dl_file
        sub_bytes = dl_file(subtitle.storage_key)

        suffix = f".{subtitle.format}" if subtitle.format else ".srt"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(sub_bytes)
            tmp_path = tmp.name

        from app.services.subtitle_generator import upload_subtitles_to_youtube
        success = await upload_subtitles_to_youtube(
            video.youtube_video_id, tmp_path, subtitle.language or "en"
        )

        if not success:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="YouTube subtitle upload failed")

        return {"success": True, "message": f"Subtitles uploaded to YouTube for video {video.youtube_video_id}"}
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
