"""Integration tests for Video API endpoints."""

import io
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.video import Video, VideoStatus


# ── Helpers ──────────────────────────────────────────────────────────────


async def _seed_video(db: AsyncSession, **overrides) -> Video:
    defaults = {
        "title": "Test Bodycam Video",
        "description": "Test description",
        "status": VideoStatus.raw_received,
    }
    defaults.update(overrides)
    video = Video(**defaults)
    db.add(video)
    await db.flush()
    return video


# ── CRUD Tests ───────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_list_videos(client: AsyncClient, db_session: AsyncSession):
    """GET /api/videos returns paginated list."""
    for i in range(3):
        await _seed_video(db_session, title=f"Video {i}")
    await db_session.commit()

    response = await client.get("/api/videos")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 3
    assert len(data["items"]) == 3


@pytest.mark.asyncio
async def test_list_videos_filter_status(client: AsyncClient, db_session: AsyncSession):
    """GET /api/videos?status= filters by status."""
    await _seed_video(db_session, status=VideoStatus.raw_received)
    await _seed_video(db_session, status=VideoStatus.published)
    await db_session.commit()

    response = await client.get("/api/videos?status=published")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["status"] == "published"


@pytest.mark.asyncio
async def test_create_video(client: AsyncClient, db_session: AsyncSession):
    """POST /api/videos creates a video record."""
    response = await client.post(
        "/api/videos",
        json={"title": "New Video", "description": "A new video"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "New Video"
    assert data["status"] == "raw_received"


@pytest.mark.asyncio
async def test_get_video(client: AsyncClient, db_session: AsyncSession):
    """GET /api/videos/{id} returns video details."""
    video = await _seed_video(db_session, title="Detail Video")
    await db_session.commit()

    response = await client.get(f"/api/videos/{video.id}")
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Detail Video"
    assert data["id"] == str(video.id)


@pytest.mark.asyncio
async def test_get_video_not_found(client: AsyncClient):
    """GET /api/videos/{id} returns 404 for unknown ID."""
    response = await client.get(f"/api/videos/{uuid.uuid4()}")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_video(client: AsyncClient, db_session: AsyncSession):
    """PATCH /api/videos/{id} updates mutable fields."""
    video = await _seed_video(db_session)
    await db_session.commit()

    response = await client.patch(
        f"/api/videos/{video.id}",
        json={"title": "Updated Title", "status": "editing", "tags": ["police", "tampa"]},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Updated Title"
    assert data["status"] == "editing"
    assert data["tags"] == ["police", "tampa"]


@pytest.mark.asyncio
async def test_delete_video(client: AsyncClient, db_session: AsyncSession):
    """DELETE /api/videos/{id} removes the video."""
    video = await _seed_video(db_session)
    await db_session.commit()

    response = await client.delete(f"/api/videos/{video.id}")
    assert response.status_code == 204

    response = await client.get(f"/api/videos/{video.id}")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_pipeline_counts(client: AsyncClient, db_session: AsyncSession):
    """GET /api/videos/pipeline-counts returns status counts."""
    await _seed_video(db_session, status=VideoStatus.raw_received)
    await _seed_video(db_session, status=VideoStatus.raw_received)
    await _seed_video(db_session, status=VideoStatus.editing)
    await db_session.commit()

    response = await client.get("/api/videos/pipeline-counts")
    assert response.status_code == 200
    data = response.json()
    assert data["counts"]["raw_received"] == 2
    assert data["counts"]["editing"] == 1


# ── Upload Validation Tests ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_upload_rejects_invalid_extension(client: AsyncClient, db_session: AsyncSession):
    """POST /api/videos/{id}/upload-raw rejects non-video file types."""
    video = await _seed_video(db_session)
    await db_session.commit()

    file_content = b"not a real executable"
    response = await client.post(
        f"/api/videos/{video.id}/upload-raw",
        files={"file": ("malware.exe", io.BytesIO(file_content), "application/octet-stream")},
    )
    assert response.status_code == 400
    assert "not allowed" in response.json()["detail"]


@pytest.mark.asyncio
async def test_upload_rejects_empty_file(client: AsyncClient, db_session: AsyncSession):
    """POST /api/videos/{id}/upload-raw rejects empty files."""
    video = await _seed_video(db_session)
    await db_session.commit()

    response = await client.post(
        f"/api/videos/{video.id}/upload-raw",
        files={"file": ("video.mp4", io.BytesIO(b""), "video/mp4")},
    )
    assert response.status_code == 400
    assert "Empty file" in response.json()["detail"]


@pytest.mark.asyncio
async def test_upload_rejects_unknown_video(client: AsyncClient):
    """POST /api/videos/{id}/upload-raw returns 404 for unknown video."""
    fake_content = b"fake video bytes"
    response = await client.post(
        f"/api/videos/{uuid.uuid4()}/upload-raw",
        files={"file": ("video.mp4", io.BytesIO(fake_content), "video/mp4")},
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_upload_accepts_valid_extension(client: AsyncClient, db_session: AsyncSession):
    """POST /api/videos/{id}/upload-raw accepts valid video extensions."""
    from unittest.mock import patch

    video = await _seed_video(db_session)
    await db_session.commit()

    fake_content = b"fake video content for testing"
    with patch("app.api.videos.extract_metadata", return_value={}), \
         patch("app.api.videos.upload_file"):
        response = await client.post(
            f"/api/videos/{video.id}/upload-raw",
            files={"file": ("bodycam.mp4", io.BytesIO(fake_content), "video/mp4")},
        )
    assert response.status_code == 200
    data = response.json()
    assert data["raw_storage_key"] is not None
    assert data["file_size_bytes"] == len(fake_content)
