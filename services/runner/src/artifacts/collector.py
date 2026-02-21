"""
ABOUTME: Artifact collector - Collects files from /artifacts directory
ABOUTME: Supports inline base64 content (for testing/dev) or S3 storage (production)
"""

import base64
import mimetypes
import os
from pathlib import Path
from typing import List

MAX_ARTIFACTS = 50
MAX_ARTIFACT_SIZE_MB = 10
MAX_TOTAL_SIZE_MB = 50
# Inline base64 for small artifacts (< 1MB each, < 5MB total)
MAX_INLINE_SIZE_MB = 1
MAX_INLINE_TOTAL_MB = 5


def collect_artifacts(
    artifacts_dir: Path,
    logs: List[str] = None,
    include_inline: bool = None,
) -> List[dict]:
    """
    Collect all files from /artifacts directory.

    Args:
        artifacts_dir: Path to artifacts directory
        logs: Optional list to append log messages
        include_inline: If True, include base64 content in response.
                       Defaults to True if EL_INLINE_ARTIFACTS env is set.

    Returns:
        List of artifact metadata dicts:
        {
            "name": str,
            "size": int,
            "mime": str,
            "storage_ref": str,
            "content_base64": str (optional, for inline artifacts)
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

    # Determine if we should include inline content
    if include_inline is None:
        # Default to True if EL_INLINE_ARTIFACTS is set, or if we're in dev mode
        include_inline = os.environ.get("EL_INLINE_ARTIFACTS", "true").lower() == "true"

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
    inline_total_size = 0
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

        # Storage reference for S3 (if configured)
        storage_ref = f"artifacts/{collected_count}/{rel_path}"

        artifact = {
            "name": str(rel_path),
            "size": file_size,
            "mime": mime_type,
            "storage_ref": storage_ref,
        }

        # Include inline base64 content for small files when requested
        # This enables artifacts to work without S3 configuration
        if include_inline:
            can_inline = (
                file_size <= MAX_INLINE_SIZE_MB * 1024 * 1024
                and inline_total_size + file_size <= MAX_INLINE_TOTAL_MB * 1024 * 1024
            )
            if can_inline:
                try:
                    content = file_path.read_bytes()
                    artifact["content_base64"] = base64.b64encode(content).decode("ascii")
                    inline_total_size += file_size
                except Exception as e:
                    log(f"WARNING: Failed to read artifact {rel_path}: {e}")

        artifacts.append(artifact)

        total_size += file_size
        collected_count += 1

    log(f"Collected {collected_count} artifacts " f"({total_size / 1024 / 1024:.2f}MB total)")
    if include_inline and inline_total_size > 0:
        log(f"Included {inline_total_size / 1024:.1f}KB inline content")

    return artifacts
