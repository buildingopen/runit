"""
ABOUTME: Artifact storage - Upload artifacts to S3/object storage and generate signed URLs
ABOUTME: Supports inline base64 content (for testing/dev) or S3 upload (production)
"""

import os
from pathlib import Path
from typing import List
from datetime import datetime, timedelta


def upload_artifacts(
    artifacts: List[dict], artifacts_dir: Path, run_id: str
) -> List[dict]:
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
    # Check if S3 is configured
    s3_bucket = os.environ.get("S3_BUCKET")
    s3_configured = bool(s3_bucket)

    for artifact in artifacts:
        # If inline content is available, generate a data: URL
        if "content_base64" in artifact and artifact["content_base64"]:
            # Create data URL for inline content
            mime = artifact.get("mime", "application/octet-stream")
            artifact["download_url"] = f"data:{mime};base64,{artifact['content_base64']}"
            artifact["storage_ref"] = "inline"
        elif s3_configured:
            # Upload to S3 (production mode)
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
                        ExpiresIn=86400,  # 24 hours
                    )
                    artifact["storage_ref"] = s3_key
            except Exception:
                # Fall back to placeholder if S3 fails
                artifact["download_url"] = (
                    f"https://storage.executionlayer.com/runs/{run_id}/"
                    f"artifacts/{artifact['name']}?expires=24h"
                )
        else:
            # No S3 configured, no inline content - generate placeholder URL
            artifact["download_url"] = (
                f"https://storage.executionlayer.com/runs/{run_id}/"
                f"artifacts/{artifact['name']}?expires=24h"
            )

    return artifacts


def generate_signed_url(storage_ref: str, expiry_hours: int = 24) -> str:
    """
    Generate a signed URL for an artifact.

    Args:
        storage_ref: S3 key or storage reference
        expiry_hours: URL expiry in hours (default 24)

    Returns:
        Signed URL string
    """
    # Check if S3 is configured
    s3_bucket = os.environ.get("S3_BUCKET")

    if s3_bucket:
        try:
            import boto3

            s3_client = boto3.client("s3")
            return s3_client.generate_presigned_url(
                "get_object",
                Params={"Bucket": s3_bucket, "Key": storage_ref},
                ExpiresIn=expiry_hours * 3600,
            )
        except Exception:
            pass  # Fall through to placeholder

    # Placeholder URL for v0 / fallback
    expiry_timestamp = (
        datetime.utcnow() + timedelta(hours=expiry_hours)
    ).isoformat()

    return (
        f"https://storage.executionlayer.com/{storage_ref}"
        f"?expires={expiry_timestamp}"
    )
