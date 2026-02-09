"""Video processing using ffmpeg/ffprobe subprocess calls."""
import asyncio
import json
import logging
import os
import tempfile
from typing import Optional

logger = logging.getLogger(__name__)


async def _run_cmd(cmd: list[str]) -> tuple[str, str, int]:
    """Run a subprocess command asynchronously."""
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()
    return stdout.decode(), stderr.decode(), proc.returncode


async def extract_metadata(file_path: str) -> dict:
    """Extract video metadata using ffprobe."""
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
    """Extract a frame as JPEG thumbnail."""
    cmd = [
        "ffmpeg", "-y", "-ss", str(timestamp), "-i", file_path,
        "-vframes", "1", "-q:v", "2", output_path,
    ]
    _, stderr, code = await _run_cmd(cmd)
    if code != 0:
        raise RuntimeError(f"Thumbnail generation failed: {stderr}")
    return output_path


async def trim_video(file_path: str, output_path: str, start: float, end: float) -> str:
    """Trim video to a segment."""
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
    """Prepend a text card intro to the video."""
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
    """Re-encode to H.264 1080p for YouTube upload."""
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
