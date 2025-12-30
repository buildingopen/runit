"""
ABOUTME: Artifact collector - Collects files from /artifacts directory
ABOUTME: Uploads to S3-compatible storage and returns metadata with signed URLs
"""

import mimetypes
from pathlib import Path
from typing import List


MAX_ARTIFACTS = 50
MAX_ARTIFACT_SIZE_MB = 10
MAX_TOTAL_SIZE_MB = 50


def collect_artifacts(artifacts_dir: Path, logs: List[str] = None) -> List[dict]:
    """
    Collect all files from /artifacts directory.

    Args:
        artifacts_dir: Path to artifacts directory
        logs: Optional list to append log messages

    Returns:
        List of artifact metadata dicts:
        {
            "name": str,
            "size": int,
            "mime": str,
            "storage_ref": str
        }

    Rules:
        - Max 50 files
        - Max 10MB per file
        - Max 50MB total
        - Exceeding limits logs warning and returns first N files
    """
    if logs is None:
        logs = []

    def log(msg: str):
        logs.append(msg)

    artifacts: List[dict] = []

    if not artifacts_dir.exists():
        log("No artifacts directory found")
        return artifacts

    # Collect all files recursively
    all_files = sorted(artifacts_dir.rglob("*"))
    files = [f for f in all_files if f.is_file()]

    if not files:
        log("No artifacts found")
        return artifacts

    log(f"Found {len(files)} artifact files")

    total_size = 0
    collected_count = 0

    for file_path in files:
        # Check file count limit
        if collected_count >= MAX_ARTIFACTS:
            log(
                f"WARNING: Artifact limit exceeded. Max {MAX_ARTIFACTS} files. "
                f"Skipping remaining {len(files) - collected_count} files."
            )
            break

        # Get file size
        file_size = file_path.stat().st_size

        # Check individual file size limit
        if file_size > MAX_ARTIFACT_SIZE_MB * 1024 * 1024:
            log(
                f"WARNING: Artifact {file_path.name} too large "
                f"({file_size / 1024 / 1024:.1f}MB > {MAX_ARTIFACT_SIZE_MB}MB). Skipping."
            )
            continue

        # Check total size limit
        if total_size + file_size > MAX_TOTAL_SIZE_MB * 1024 * 1024:
            log(
                f"WARNING: Total artifact size limit exceeded "
                f"({MAX_TOTAL_SIZE_MB}MB). Collected {collected_count} files."
            )
            break

        # Determine MIME type
        mime_type, _ = mimetypes.guess_type(file_path.name)
        if mime_type is None:
            # Default MIME types for common extensions
            ext = file_path.suffix.lower()
            mime_map = {
                ".json": "application/json",
                ".csv": "text/csv",
                ".txt": "text/plain",
                ".pdf": "application/pdf",
                ".png": "image/png",
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg",
                ".gif": "image/gif",
                ".svg": "image/svg+xml",
                ".html": "text/html",
                ".xml": "application/xml",
            }
            mime_type = mime_map.get(ext, "application/octet-stream")

        # Relative path from artifacts_dir
        rel_path = file_path.relative_to(artifacts_dir)

        # Upload to storage (placeholder for v0 - actual S3 upload would go here)
        # For v0, we just record metadata
        storage_ref = f"artifacts/{collected_count}/{rel_path}"

        artifacts.append(
            {
                "name": str(rel_path),
                "size": file_size,
                "mime": mime_type,
                "storage_ref": storage_ref,
            }
        )

        total_size += file_size
        collected_count += 1

    log(
        f"Collected {collected_count} artifacts "
        f"({total_size / 1024 / 1024:.2f}MB total)"
    )

    return artifacts
