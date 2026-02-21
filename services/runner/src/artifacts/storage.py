"""
ABOUTME: Artifact storage - Upload artifacts to S3/object storage and generate signed URLs
ABOUTME: Supports inline base64 content (for testing/dev) or S3 upload (production)
"""

import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List

# Constants
PRESIGNED_URL_EXPIRY_SECONDS = 86400  # 24 hours
DEFAULT_EXPIRY_HOURS = 24
SECONDS_PER_HOUR = 3600
PLACEHOLDER_STORAGE_HOST = "https://storage.placeholder.local"


def _placeholder_url(path: str, expiry_hint: str = "24h") -> str:
    """Return a clearly-fake placeholder URL when S3 is not configured."""
    return f"{PLACEHOLDER_STORAGE_HOST}/{path}?expires={expiry_hint}&notice=s3_not_configured"


def upload_artifacts(artifacts: List[dict], artifacts_dir: Path, run_id: str) -> List[dict]:
    """
    Upload artifacts to S3-compatible storage and add signed URLs.

    If artifacts have inline base64 content (from collector), they can be
    served directly without S3. Otherwise, uploads to S3 and generates
    presigned URLs.

    Args:
        artifacts: List of artifact metadata from collector
        artifacts_dir: Path to artifacts directory
        run_id: Run ID for storage path

    Returns:
        List of artifact metadata with added download URLs:
        {
            "name": str,
            "size": int,
            "mime": str,
            "storage_ref": str,  # S3 key or "inline"
            "download_url": str,  # Signed URL or data: URL
            "content_base64": str (optional, for inline artifacts)
        }
    """
    s3_bucket = os.environ.get("S3_BUCKET")
    s3_configured = bool(s3_bucket)

    for artifact in artifacts:
        if "content_base64" in artifact and artifact["content_base64"]:
            mime = artifact.get("mime", "application/octet-stream")
            artifact["download_url"] = f"data:{mime};base64,{artifact['content_base64']}"
            artifact["storage_ref"] = "inline"
        elif s3_configured:
            try:
                import boto3

                s3_client = boto3.client("s3")
                file_path = artifacts_dir / artifact["name"]
                s3_key = f"runs/{run_id}/artifacts/{artifact['name']}"

                if file_path.exists():
                    s3_client.upload_file(
                        str(file_path),
                        s3_bucket,
                        s3_key,
                        ExtraArgs={"ContentType": artifact.get("mime", "application/octet-stream")},
                    )
                    artifact["download_url"] = s3_client.generate_presigned_url(
                        "get_object",
                        Params={"Bucket": s3_bucket, "Key": s3_key},
                        ExpiresIn=PRESIGNED_URL_EXPIRY_SECONDS,
                    )
                    artifact["storage_ref"] = s3_key
            except Exception as exc:
                print(f"[WARN] S3 upload failed for {artifact['name']}: {exc}", file=sys.stderr)
                artifact["download_url"] = _placeholder_url(
                    f"runs/{run_id}/artifacts/{artifact['name']}"
                )
        else:
            artifact["download_url"] = _placeholder_url(
                f"runs/{run_id}/artifacts/{artifact['name']}"
            )

    return artifacts


def generate_signed_url(storage_ref: str, expiry_hours: int = DEFAULT_EXPIRY_HOURS) -> str:
    """
    Generate a signed URL for an artifact.

    Args:
        storage_ref: S3 key or storage reference
        expiry_hours: URL expiry in hours (default 24)

    Returns:
        Signed URL string
    """
    s3_bucket = os.environ.get("S3_BUCKET")

    if s3_bucket:
        try:
            import boto3

            s3_client = boto3.client("s3")
            return s3_client.generate_presigned_url(
                "get_object",
                Params={"Bucket": s3_bucket, "Key": storage_ref},
                ExpiresIn=expiry_hours * SECONDS_PER_HOUR,
            )
        except Exception as exc:
            print(f"[WARN] S3 presigned URL generation failed: {exc}", file=sys.stderr)

    expiry_timestamp = (datetime.now(timezone.utc) + timedelta(hours=expiry_hours)).isoformat()

    return (
        f"{PLACEHOLDER_STORAGE_HOST}/{storage_ref}"
        f"?expires={expiry_timestamp}&notice=s3_not_configured"
    )
