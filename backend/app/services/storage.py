"""S3/R2 object storage abstraction."""
import logging
from typing import Optional
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from app.config import settings

logger = logging.getLogger(__name__)


def _get_s3_client():
    """Create S3 client configured for R2 or standard S3."""
    config = Config(signature_version="s3v4")
    kwargs = {
        "service_name": "s3",
        "config": config,
    }
    if settings.S3_ENDPOINT:
        kwargs["endpoint_url"] = settings.S3_ENDPOINT
    if settings.S3_ACCESS_KEY:
        kwargs["aws_access_key_id"] = settings.S3_ACCESS_KEY
    if settings.S3_SECRET_KEY:
        kwargs["aws_secret_access_key"] = settings.S3_SECRET_KEY
    if settings.S3_REGION:
        kwargs["region_name"] = settings.S3_REGION
    return boto3.client(**kwargs)


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    retry=retry_if_exception_type(ClientError),
    reraise=True,
)
def upload_file(file_bytes: bytes, key: str, content_type: str = "application/octet-stream") -> str:
    """Upload file to S3/R2 with retry logic (3 attempts, exponential backoff 2-10s).

    Raises:
        ClientError: If S3 upload fails after 3 attempts.
    """
    client = _get_s3_client()
    client.put_object(
        Bucket=settings.S3_BUCKET_NAME,
        Key=key,
        Body=file_bytes,
        ContentType=content_type,
    )
    logger.info(f"Uploaded {key} ({len(file_bytes)} bytes)")
    return key


def download_file(key: str) -> bytes:
    """Download file from S3/R2."""
    client = _get_s3_client()
    response = client.get_object(Bucket=settings.S3_BUCKET_NAME, Key=key)
    return response["Body"].read()


def generate_presigned_url(key: str, expiry: int = 3600) -> str:
    """Generate a presigned URL for direct access."""
    client = _get_s3_client()
    return client.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.S3_BUCKET_NAME, "Key": key},
        ExpiresIn=expiry,
    )


def delete_file(key: str):
    """Delete a file from S3/R2."""
    client = _get_s3_client()
    client.delete_object(Bucket=settings.S3_BUCKET_NAME, Key=key)
    logger.info(f"Deleted {key}")


def test_storage_connection() -> bool:
    """Test if S3/R2 storage is configured and accessible.

    Returns:
        True if storage is configured and reachable, False otherwise.
    """
    if not settings.S3_BUCKET_NAME:
        logger.warning("S3_BUCKET_NAME not configured")
        return False

    try:
        client = _get_s3_client()
        # Simple head_bucket check - doesn't count against quota
        client.head_bucket(Bucket=settings.S3_BUCKET_NAME)
        logger.info(f"Storage health check passed for bucket: {settings.S3_BUCKET_NAME}")
        return True
    except Exception as e:
        logger.error(f"Storage health check failed: {e}")
        return False
