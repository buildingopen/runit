"""Tests for artifact storage module."""

import base64

from artifacts.storage import upload_artifacts, generate_signed_url


def test_upload_artifacts_inline_content(tmp_path):
    artifacts = [
        {
            "name": "result.json",
            "size": 42,
            "mime": "application/json",
            "content_base64": base64.b64encode(b'{"ok": true}').decode(),
        }
    ]
    result = upload_artifacts(artifacts, tmp_path, "run-1")
    assert len(result) == 1
    assert result[0]["storage_ref"] == "inline"
    assert result[0]["download_url"].startswith("data:application/json;base64,")


def test_upload_artifacts_no_s3_no_inline(tmp_path, monkeypatch):
    monkeypatch.delenv("S3_BUCKET", raising=False)
    artifacts = [
        {"name": "file.txt", "size": 10, "mime": "text/plain"}
    ]
    result = upload_artifacts(artifacts, tmp_path, "run-2")
    assert result[0]["download_url"].startswith("https://storage.placeholder.local/runs/run-2/")


def test_upload_artifacts_empty_list(tmp_path):
    result = upload_artifacts([], tmp_path, "run-3")
    assert result == []


def test_generate_signed_url_no_s3(monkeypatch):
    monkeypatch.delenv("S3_BUCKET", raising=False)
    url = generate_signed_url("runs/r1/artifacts/data.csv", expiry_hours=12)
    assert "storage.placeholder.local" in url
    assert "runs/r1/artifacts/data.csv" in url
    assert "expires=" in url


def test_generate_signed_url_with_s3_failure(monkeypatch):
    monkeypatch.setenv("S3_BUCKET", "test-bucket")
    # boto3 not installed, so S3 path will fail and fall through to placeholder
    url = generate_signed_url("runs/r1/artifacts/data.csv")
    assert "storage.placeholder.local" in url
