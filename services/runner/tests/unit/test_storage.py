"""Tests for artifact storage module."""

import base64
from unittest.mock import MagicMock, patch

from artifacts.storage import generate_signed_url, upload_artifacts


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
    artifacts = [{"name": "file.txt", "size": 10, "mime": "text/plain"}]
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


def test_upload_artifacts_s3_success(tmp_path, monkeypatch):
    """When S3 is configured and file exists, upload succeeds."""
    monkeypatch.setenv("S3_BUCKET", "my-bucket")

    # Create the artifact file on disk
    (tmp_path / "output.csv").write_text("a,b\n1,2")

    mock_s3 = MagicMock()
    mock_s3.generate_presigned_url.return_value = "https://s3.example.com/signed-url"

    mock_boto3 = MagicMock()
    mock_boto3.client.return_value = mock_s3

    artifacts = [{"name": "output.csv", "size": 10, "mime": "text/csv"}]

    with patch.dict("sys.modules", {"boto3": mock_boto3}):
        result = upload_artifacts(artifacts, tmp_path, "run-s3")

    assert result[0]["download_url"] == "https://s3.example.com/signed-url"
    assert result[0]["storage_ref"] == "runs/run-s3/artifacts/output.csv"
    mock_s3.upload_file.assert_called_once()


def test_upload_artifacts_s3_upload_failure(tmp_path, monkeypatch):
    """When S3 upload fails, falls back to placeholder URL."""
    monkeypatch.setenv("S3_BUCKET", "my-bucket")

    (tmp_path / "data.json").write_text("{}")

    mock_s3 = MagicMock()
    mock_s3.upload_file.side_effect = Exception("Connection refused")

    mock_boto3 = MagicMock()
    mock_boto3.client.return_value = mock_s3

    artifacts = [{"name": "data.json", "size": 2, "mime": "application/json"}]

    with patch.dict("sys.modules", {"boto3": mock_boto3}):
        result = upload_artifacts(artifacts, tmp_path, "run-fail")

    assert "storage.placeholder.local" in result[0]["download_url"]


def test_generate_signed_url_s3_success(monkeypatch):
    """When S3 is configured, returns a presigned URL."""
    monkeypatch.setenv("S3_BUCKET", "my-bucket")

    mock_s3 = MagicMock()
    mock_s3.generate_presigned_url.return_value = "https://s3.example.com/presigned"

    mock_boto3 = MagicMock()
    mock_boto3.client.return_value = mock_s3

    with patch.dict("sys.modules", {"boto3": mock_boto3}):
        url = generate_signed_url("runs/r1/artifacts/file.txt", expiry_hours=6)

    assert url == "https://s3.example.com/presigned"
