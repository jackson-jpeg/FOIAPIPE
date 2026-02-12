"""Subtitle generation service using speech-to-text.

Supports multiple STT providers (OpenAI Whisper, Google, etc.)
"""

from __future__ import annotations

import logging
from datetime import timedelta
from enum import Enum
from pathlib import Path
from typing import Optional

from app.config import settings

logger = logging.getLogger(__name__)


class SubtitleFormat(str, Enum):
    """Supported subtitle formats."""

    srt = "srt"  # SubRip (.srt)
    vtt = "vtt"  # WebVTT (.vtt)
    ass = "ass"  # Advanced SubStation Alpha (.ass)


class STTProvider(str, Enum):
    """Speech-to-text providers."""

    whisper = "whisper"  # OpenAI Whisper API
    google = "google"  # Google Speech-to-Text
    azure = "azure"  # Azure Speech Services
    mock = "mock"  # Mock provider for testing


def format_timestamp_srt(seconds: float) -> str:
    """Format timestamp for SRT format (HH:MM:SS,mmm).

    Args:
        seconds: Time in seconds

    Returns:
        Formatted timestamp string
    """
    td = timedelta(seconds=seconds)
    hours = int(td.total_seconds() // 3600)
    minutes = int((td.total_seconds() % 3600) // 60)
    secs = int(td.total_seconds() % 60)
    millis = int((td.total_seconds() % 1) * 1000)

    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"


def format_timestamp_vtt(seconds: float) -> str:
    """Format timestamp for VTT format (HH:MM:SS.mmm).

    Args:
        seconds: Time in seconds

    Returns:
        Formatted timestamp string
    """
    td = timedelta(seconds=seconds)
    hours = int(td.total_seconds() // 3600)
    minutes = int((td.total_seconds() % 3600) // 60)
    secs = int(td.total_seconds() % 60)
    millis = int((td.total_seconds() % 1) * 1000)

    return f"{hours:02d}:{minutes:02d}:{secs:02d}.{millis:03d}"


def generate_srt(segments: list[dict]) -> str:
    """Generate SRT subtitle file content.

    Args:
        segments: List of subtitle segments with start, end, text

    Returns:
        SRT file content as string
    """
    lines = []

    for i, segment in enumerate(segments, 1):
        start = format_timestamp_srt(segment["start"])
        end = format_timestamp_srt(segment["end"])
        text = segment["text"].strip()

        lines.append(f"{i}")
        lines.append(f"{start} --> {end}")
        lines.append(text)
        lines.append("")  # Blank line between segments

    return "\n".join(lines)


def generate_vtt(segments: list[dict]) -> str:
    """Generate WebVTT subtitle file content.

    Args:
        segments: List of subtitle segments with start, end, text

    Returns:
        VTT file content as string
    """
    lines = ["WEBVTT", ""]  # VTT header

    for segment in segments:
        start = format_timestamp_vtt(segment["start"])
        end = format_timestamp_vtt(segment["end"])
        text = segment["text"].strip()

        lines.append(f"{start} --> {end}")
        lines.append(text)
        lines.append("")  # Blank line between segments

    return "\n".join(lines)


async def transcribe_audio_whisper(
    audio_file_path: str,
    language: str = "en",
) -> list[dict]:
    """Transcribe audio using OpenAI Whisper API.

    Args:
        audio_file_path: Path to audio/video file
        language: Language code (default: en)

    Returns:
        List of segments with timestamps and text

    Note:
        Requires OPENAI_API_KEY environment variable.
        Install: pip install openai
    """
    try:
        import openai

        if not settings.OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY not configured")

        client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)

        # Open audio file
        with open(audio_file_path, "rb") as audio_file:
            # Call Whisper API
            transcript = client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                response_format="verbose_json",
                timestamp_granularities=["segment"],
                language=language,
            )

        # Convert to our segment format
        segments = []
        for segment in transcript.segments:
            segments.append({
                "start": segment.start,
                "end": segment.end,
                "text": segment.text,
            })

        logger.info(f"Transcribed {len(segments)} segments from {audio_file_path}")
        return segments

    except ImportError:
        logger.error("OpenAI library not installed. Install: pip install openai")
        raise
    except Exception as e:
        logger.error(f"Whisper transcription failed: {e}")
        raise


async def transcribe_audio_mock(
    audio_file_path: str,
    language: str = "en",
) -> list[dict]:
    """Mock transcription for testing (generates placeholder subtitles).

    Args:
        audio_file_path: Path to audio/video file
        language: Language code (default: en)

    Returns:
        List of mock segments
    """
    logger.info(f"Mock transcription for: {audio_file_path}")

    # Generate mock segments based on file duration
    # In production, this would be replaced with actual transcription
    segments = [
        {"start": 0.0, "end": 5.0, "text": "[Officer-involved incident footage]"},
        {"start": 5.0, "end": 10.0, "text": "[Body camera recording]"},
        {"start": 10.0, "end": 15.0, "text": "[Audio transcription pending]"},
    ]

    return segments


async def generate_subtitles(
    video_file_path: str,
    output_path: Optional[str] = None,
    subtitle_format: SubtitleFormat = SubtitleFormat.srt,
    provider: STTProvider = STTProvider.whisper,
    language: str = "en",
) -> str:
    """Generate subtitles for a video file.

    Args:
        video_file_path: Path to video file
        output_path: Where to save subtitle file (optional)
        subtitle_format: Subtitle format (srt, vtt, ass)
        provider: Speech-to-text provider
        language: Language code

    Returns:
        Path to generated subtitle file
    """
    logger.info(
        f"Generating {subtitle_format.value} subtitles for {video_file_path} "
        f"using {provider.value}"
    )

    # Transcribe audio
    if provider == STTProvider.whisper:
        segments = await transcribe_audio_whisper(video_file_path, language)
    elif provider == STTProvider.mock:
        segments = await transcribe_audio_mock(video_file_path, language)
    else:
        raise ValueError(f"Unsupported STT provider: {provider}")

    # Generate subtitle file content
    if subtitle_format == SubtitleFormat.srt:
        content = generate_srt(segments)
        extension = ".srt"
    elif subtitle_format == SubtitleFormat.vtt:
        content = generate_vtt(segments)
        extension = ".vtt"
    else:
        raise ValueError(f"Unsupported subtitle format: {subtitle_format}")

    # Determine output path
    if not output_path:
        video_path = Path(video_file_path)
        output_path = str(video_path.with_suffix(extension))

    # Write subtitle file
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(content)

    logger.info(f"Subtitles saved to: {output_path}")
    return output_path


async def upload_subtitles_to_youtube(
    video_id: str,
    subtitle_file_path: str,
    language: str = "en",
) -> bool:
    """Upload subtitles to YouTube video.

    Args:
        video_id: YouTube video ID
        subtitle_file_path: Path to subtitle file
        language: Language code

    Returns:
        True if successful
    """
    try:
        from googleapiclient.http import MediaFileUpload
        from app.services.youtube_client import _get_youtube_service

        logger.info(f"Uploading subtitles to YouTube video {video_id}")

        youtube = _get_youtube_service()
        media = MediaFileUpload(subtitle_file_path, mimetype="application/octet-stream")
        youtube.captions().insert(
            part="snippet",
            body={
                "snippet": {
                    "videoId": video_id,
                    "language": language,
                    "name": f"{language} subtitles",
                    "isDraft": False,
                }
            },
            media_body=media,
        ).execute()

        logger.info(f"Subtitles uploaded to YouTube video {video_id}")
        return True

    except Exception as e:
        logger.error(f"YouTube subtitle upload failed: {e}")
        return False


def validate_subtitle_file(subtitle_file_path: str) -> dict:
    """Validate a subtitle file and return statistics.

    Args:
        subtitle_file_path: Path to subtitle file

    Returns:
        Dict with validation results and statistics
    """
    try:
        with open(subtitle_file_path, "r", encoding="utf-8") as f:
            content = f.read()

        # Detect format
        is_vtt = content.startswith("WEBVTT")
        is_srt = "-->" in content and not is_vtt

        if not (is_vtt or is_srt):
            return {
                "valid": False,
                "error": "Unknown subtitle format",
            }

        # Count segments
        segment_count = content.count("-->")

        # Calculate total duration (approximate)
        lines = content.split("\n")
        last_timestamp = None

        for line in reversed(lines):
            if "-->" in line:
                parts = line.split("-->")
                if len(parts) == 2:
                    last_timestamp = parts[1].strip()
                    break

        return {
            "valid": True,
            "format": "vtt" if is_vtt else "srt",
            "segment_count": segment_count,
            "last_timestamp": last_timestamp,
            "file_size_bytes": len(content.encode("utf-8")),
        }

    except Exception as e:
        return {
            "valid": False,
            "error": str(e),
        }
