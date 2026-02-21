"""Tests for artifact collector module."""

from artifacts.collector import (
    MAX_ARTIFACT_SIZE_MB,
    collect_artifacts,
)


def test_collect_no_directory(tmp_path):
    """Directory does not exist -> empty list."""
    missing = tmp_path / "nonexistent"
    logs = []
    result = collect_artifacts(missing, logs=logs)
    assert result == []
    assert any("No artifacts directory" in msg for msg in logs)


def test_collect_empty_directory(tmp_path):
    """Directory exists but has no files."""
    artifacts_dir = tmp_path / "artifacts"
    artifacts_dir.mkdir()
    logs = []
    result = collect_artifacts(artifacts_dir, logs=logs)
    assert result == []
    assert any("No artifacts found" in msg for msg in logs)


def test_collect_single_file(tmp_path):
    """Collects a single small file with inline content."""
    artifacts_dir = tmp_path / "artifacts"
    artifacts_dir.mkdir()
    (artifacts_dir / "result.json").write_text('{"ok": true}')

    logs = []
    result = collect_artifacts(artifacts_dir, logs=logs, include_inline=True)

    assert len(result) == 1
    assert result[0]["name"] == "result.json"
    assert result[0]["mime"] == "application/json"
    assert "content_base64" in result[0]


def test_collect_skips_oversized_file(tmp_path):
    """Files larger than MAX_ARTIFACT_SIZE_MB are skipped."""
    artifacts_dir = tmp_path / "artifacts"
    artifacts_dir.mkdir()

    # Create a file just over the limit
    big_file = artifacts_dir / "big.bin"
    big_file.write_bytes(b"\x00" * (MAX_ARTIFACT_SIZE_MB * 1024 * 1024 + 1))

    # Also create a small file to verify it's still collected
    (artifacts_dir / "small.txt").write_text("hello")

    logs = []
    result = collect_artifacts(artifacts_dir, logs=logs, include_inline=False)

    assert len(result) == 1
    assert result[0]["name"] == "small.txt"
    assert any("too large" in msg for msg in logs)


def test_collect_respects_total_size_limit(tmp_path, monkeypatch):
    """Stops collecting when total size exceeds MAX_TOTAL_SIZE_MB."""
    artifacts_dir = tmp_path / "artifacts"
    artifacts_dir.mkdir()

    # Temporarily lower the limit for testing
    import artifacts.collector as mod

    original = mod.MAX_TOTAL_SIZE_MB
    mod.MAX_TOTAL_SIZE_MB = 1  # 1MB total limit

    try:
        # Create files that together exceed 1MB
        for i in range(3):
            (artifacts_dir / f"file_{i}.bin").write_bytes(b"\x00" * (512 * 1024))  # 512KB each

        logs = []
        result = collect_artifacts(artifacts_dir, logs=logs, include_inline=False)

        # Only 2 should fit (2 * 512KB = 1MB)
        assert len(result) == 2
        assert any("Total artifact size limit" in msg for msg in logs)
    finally:
        mod.MAX_TOTAL_SIZE_MB = original


def test_collect_respects_file_count_limit(tmp_path):
    """Stops collecting after MAX_ARTIFACTS files."""
    artifacts_dir = tmp_path / "artifacts"
    artifacts_dir.mkdir()

    import artifacts.collector as mod

    original = mod.MAX_ARTIFACTS
    mod.MAX_ARTIFACTS = 3

    try:
        for i in range(5):
            (artifacts_dir / f"file_{i}.txt").write_text(f"content {i}")

        logs = []
        result = collect_artifacts(artifacts_dir, logs=logs, include_inline=False)

        assert len(result) == 3
        assert any("Artifact limit exceeded" in msg for msg in logs)
    finally:
        mod.MAX_ARTIFACTS = original


def test_collect_without_inline(tmp_path):
    """When include_inline=False, no content_base64 is added."""
    artifacts_dir = tmp_path / "artifacts"
    artifacts_dir.mkdir()
    (artifacts_dir / "data.csv").write_text("a,b\n1,2")

    result = collect_artifacts(artifacts_dir, include_inline=False)

    assert len(result) == 1
    assert "content_base64" not in result[0]
    assert result[0]["mime"] == "text/csv"


def test_collect_unknown_extension(tmp_path):
    """Unknown extension falls back to application/octet-stream."""
    artifacts_dir = tmp_path / "artifacts"
    artifacts_dir.mkdir()
    (artifacts_dir / "data.qzx").write_bytes(b"\x00\x01\x02")

    result = collect_artifacts(artifacts_dir, include_inline=False)

    assert len(result) == 1
    assert result[0]["mime"] == "application/octet-stream"


def test_collect_logs_default_to_empty_list(tmp_path):
    """When logs=None, no error occurs."""
    artifacts_dir = tmp_path / "artifacts"
    artifacts_dir.mkdir()
    (artifacts_dir / "a.txt").write_text("hello")

    result = collect_artifacts(artifacts_dir, logs=None, include_inline=False)
    assert len(result) == 1
