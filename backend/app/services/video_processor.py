"""Video processing using ffmpeg/ffprobe subprocess calls.

This module provides async wrappers around ffmpeg and ffprobe for:
- Extracting video metadata (duration, resolution, codec, etc.)
- Generating thumbnails from video frames
- Trimming and cutting video segments
- Adding intro cards with text overlays
- Optimizing videos for YouTube upload (H.264 1080p)
- Creating YouTube-style thumbnails with text

All functions run ffmpeg/ffprobe commands asynchronously to avoid blocking.
Requires ffmpeg and ffprobe to be installed and available in PATH.
"""

import asyncio
import json
import logging
from typing import Optional

logger = logging.getLogger(__name__)


async def _run_cmd(cmd: list[str]) -> tuple[str, str, int]:
    """Run a subprocess command asynchronously.

    Args:
        cmd: Command and arguments as a list (e.g., ["ffmpeg", "-i", "input.mp4"])

    Returns:
        Tuple of (stdout, stderr, returncode)
    """
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()
    return stdout.decode(), stderr.decode(), proc.returncode


async def extract_metadata(file_path: str) -> dict:
    """Extract video metadata using ffprobe.

    Args:
        file_path: Path to video file

    Returns:
        Dictionary containing:
            - duration_seconds: Video duration in seconds (int)
            - resolution: Resolution string (e.g., "1920x1080")
            - codec: Video codec name (e.g., "h264")
            - file_size_bytes: File size in bytes
            - bitrate: Bitrate in bits per second

    Raises:
        RuntimeError: If ffprobe command fails
        FileNotFoundError: If ffprobe is not installed
    """
    cmd = [
        "ffprobe", "-v", "quiet", "-print_format", "json",
        "-show_format", "-show_streams", file_path,
    ]
    stdout, stderr, code = await _run_cmd(cmd)
    if code != 0:
        raise RuntimeError(f"ffprobe failed: {stderr}")

    data = json.loads(stdout)
    video_stream = next((s for s in data.get("streams", []) if s["codec_type"] == "video"), None)
    fmt = data.get("format", {})

    return {
        "duration_seconds": int(float(fmt.get("duration", 0))),
        "resolution": f"{video_stream['width']}x{video_stream['height']}" if video_stream else None,
        "codec": video_stream.get("codec_name") if video_stream else None,
        "file_size_bytes": int(fmt.get("size", 0)),
        "bitrate": int(fmt.get("bit_rate", 0)),
    }


async def generate_thumbnail(file_path: str, output_path: str, timestamp: int = 30) -> str:
    """Extract a frame as JPEG thumbnail.

    Args:
        file_path: Path to source video file
        output_path: Path where thumbnail should be saved (should end in .jpg)
        timestamp: Second in video to extract frame from (default: 30)

    Returns:
        Path to generated thumbnail file

    Raises:
        RuntimeError: If ffmpeg command fails
        FileNotFoundError: If ffmpeg is not installed
    """
    cmd = [
        "ffmpeg", "-y", "-ss", str(timestamp), "-i", file_path,
        "-vframes", "1", "-q:v", "2", output_path,
    ]
    _, stderr, code = await _run_cmd(cmd)
    if code != 0:
        raise RuntimeError(f"Thumbnail generation failed: {stderr}")
    return output_path


async def trim_video(file_path: str, output_path: str, start: float, end: float) -> str:
    """Trim video to a segment using stream copy (fast, no re-encoding).

    Args:
        file_path: Path to source video file
        output_path: Path where trimmed video should be saved
        start: Start time in seconds
        end: End time in seconds

    Returns:
        Path to trimmed video file

    Raises:
        RuntimeError: If ffmpeg command fails
        FileNotFoundError: If ffmpeg is not installed
    """
    cmd = [
        "ffmpeg", "-y", "-i", file_path,
        "-ss", str(start), "-to", str(end),
        "-c", "copy", output_path,
    ]
    _, stderr, code = await _run_cmd(cmd)
    if code != 0:
        raise RuntimeError(f"Trim failed: {stderr}")
    return output_path


async def add_intro_card(file_path: str, output_path: str, text: str, duration: int = 5) -> str:
    """Prepend a text card intro to the video.

    Creates a black screen with white text and concatenates it with the source video.

    Args:
        file_path: Path to source video file
        output_path: Path where output video should be saved
        text: Text to display on intro card
        duration: Duration of intro card in seconds (default: 5)

    Returns:
        Path to output video file

    Raises:
        RuntimeError: If ffmpeg command fails
        FileNotFoundError: If ffmpeg is not installed

    Note:
        This re-encodes the video which may be slow for large files.
    """
    # Create intro with text overlay
    cmd = [
        "ffmpeg", "-y",
        "-f", "lavfi", "-i", f"color=c=black:s=1920x1080:d={duration}",
        "-vf", f"drawtext=text='{text}':fontcolor=white:fontsize=48:x=(w-text_w)/2:y=(h-text_h)/2",
        "-i", file_path,
        "-filter_complex", "[0:v][1:v]concat=n=2:v=1:a=0",
        output_path,
    ]
    _, stderr, code = await _run_cmd(cmd)
    if code != 0:
        raise RuntimeError(f"Intro card failed: {stderr}")
    return output_path


async def export_youtube_optimized(file_path: str, output_path: str) -> str:
    """Re-encode video to H.264 1080p optimized for YouTube upload.

    Applies YouTube's recommended encoding settings:
    - H.264 video codec with CRF 20 (high quality)
    - Scales to 1920x1080 with letterboxing if needed
    - AAC audio at 192kbps
    - Faststart flag for streaming

    Args:
        file_path: Path to source video file
        output_path: Path where optimized video should be saved

    Returns:
        Path to optimized video file

    Raises:
        RuntimeError: If ffmpeg command fails
        FileNotFoundError: If ffmpeg is not installed

    Note:
        This re-encodes the entire video which can be slow.
        Use a faster preset if needed (currently using "medium").
    """
    cmd = [
        "ffmpeg", "-y", "-i", file_path,
        "-c:v", "libx264", "-preset", "medium", "-crf", "20",
        "-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2",
        "-c:a", "aac", "-b:a", "192k",
        "-movflags", "+faststart",
        output_path,
    ]
    _, stderr, code = await _run_cmd(cmd)
    if code != 0:
        raise RuntimeError(f"YouTube export failed: {stderr}")
    return output_path


async def generate_youtube_thumbnail(
    file_path: str,
    output_path: str,
    title_text: str,
    agency_text: str,
    timestamp: int = 30,
) -> str:
    """Generate YouTube-style thumbnail with text overlay.

    Args:
        file_path: Source video file
        output_path: Output JPEG path
        title_text: Main title text (e.g., "BODYCAM: Officer-Involved Shooting")
        agency_text: Agency/date text (e.g., "Tampa Police - Feb 9, 2026")
        timestamp: Second to extract frame from

    Returns:
        Path to generated thumbnail
    """
    # Escape single quotes in text for ffmpeg
    title_text = title_text.replace("'", "'\\''")
    agency_text = agency_text.replace("'", "'\\''")

    # Create YouTube-style thumbnail with text overlays
    # - Extract frame at timestamp
    # - Add dark gradient overlay for text readability
    # - Add title text (large, bold, top)
    # - Add agency text (smaller, bottom)
    cmd = [
        "ffmpeg", "-y",
        "-ss", str(timestamp),
        "-i", file_path,
        "-vf",
        # Extract one frame, add gradient overlay, add text
        (
            f"scale=1280:720:force_original_aspect_ratio=increase,"
            f"crop=1280:720,"
            # Add dark gradient overlay for text readability
            f"drawbox=y=0:color=black@0.6:width=iw:height=150:t=fill,"
            f"drawbox=y=ih-100:color=black@0.6:width=iw:height=100:t=fill,"
            # Add title text (large, white, top)
            f"drawtext=text='{title_text}':fontcolor=white:fontsize=56:fontfile=/System/Library/Fonts/Supplemental/Arial Bold.ttf:x=(w-text_w)/2:y=40,"
            # Add agency/date text (smaller, yellow, bottom)
            f"drawtext=text='{agency_text}':fontcolor=yellow:fontsize=36:fontfile=/System/Library/Fonts/Supplemental/Arial.ttf:x=(w-text_w)/2:y=h-70"
        ),
        "-vframes", "1",
        "-q:v", "2",  # High quality JPEG
        output_path,
    ]

    _, stderr, code = await _run_cmd(cmd)
    if code != 0:
        # Fallback to basic thumbnail if text overlay fails
        logger.warning(f"YouTube thumbnail generation failed: {stderr}, falling back to basic")
        return await generate_thumbnail(file_path, output_path, timestamp)

    return output_path
