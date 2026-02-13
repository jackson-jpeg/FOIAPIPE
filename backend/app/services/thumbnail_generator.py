"""AI thumbnail generation using DALL-E 3 API.

Generates branded thumbnails for bodycam/police accountability videos
with consistent styling for the FOIA Archive YouTube channel.
"""

from __future__ import annotations

import logging
from typing import Optional

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

THUMBNAIL_STYLE_PROMPT = """Create a compelling YouTube thumbnail for a law enforcement accountability video.
Style: Bold, dramatic, high contrast, news-style graphic.
Colors: Dark background with red and blue accents (police lights aesthetic).
Include: Bold white text overlay area at the bottom third.
DO NOT include any text — the text overlay will be added separately.
Resolution: 1280x720 (YouTube standard)."""


async def generate_ai_thumbnail(
    title: str,
    incident_description: Optional[str] = None,
    frame_description: Optional[str] = None,
) -> dict:
    """Generate an AI thumbnail using DALL-E 3.

    Args:
        title: Video title for context
        incident_description: Description of the incident for visual context
        frame_description: Description of a reference frame (optional)

    Returns:
        Dict with url (temporary DALL-E URL), revised_prompt
    """
    if not settings.OPENAI_API_KEY:
        return {"error": "OpenAI API key not configured"}

    context_parts = [THUMBNAIL_STYLE_PROMPT]
    if incident_description:
        context_parts.append(f"Scene context: {incident_description[:200]}")
    if frame_description:
        context_parts.append(f"Reference frame: {frame_description[:200]}")
    context_parts.append(
        f"This is for a video titled: '{title[:100]}'"
    )

    prompt = "\n".join(context_parts)

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                "https://api.openai.com/v1/images/generations",
                headers={
                    "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "dall-e-3",
                    "prompt": prompt,
                    "n": 1,
                    "size": "1792x1024",  # Closest to 16:9 ratio
                    "quality": "standard",
                },
            )
            response.raise_for_status()
            data = response.json()

        image_data = data["data"][0]
        return {
            "url": image_data["url"],
            "revised_prompt": image_data.get("revised_prompt"),
        }

    except httpx.HTTPStatusError as e:
        logger.error(f"DALL-E API error: {e.response.status_code} - {e.response.text[:200]}")
        return {"error": f"DALL-E API error: {e.response.status_code}"}
    except Exception as e:
        logger.error(f"Thumbnail generation failed: {e}")
        return {"error": str(e)}


async def download_and_store_thumbnail(
    image_url: str, video_id: str
) -> dict:
    """Download a DALL-E generated image and store it in S3.

    Args:
        image_url: Temporary DALL-E URL
        video_id: Video ID for storage key naming

    Returns:
        Dict with storage_key, success status
    """
    from app.services.storage import upload_file

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(image_url)
            response.raise_for_status()
            image_bytes = response.content

        storage_key = f"thumbnails/ai/{video_id}.png"
        upload_file(image_bytes, storage_key, content_type="image/png")

        return {"success": True, "storage_key": storage_key}

    except Exception as e:
        logger.error(f"Failed to download/store AI thumbnail: {e}")
        return {"success": False, "error": str(e)}
