"""Tests for artifacts module."""

import json
import tempfile
from pathlib import Path

import pytest
from runit import save_artifact, save_dataframe, save_json


@pytest.fixture
def temp_artifacts_dir(monkeypatch):
    """Create temporary artifacts directory."""
    with tempfile.TemporaryDirectory() as tmpdir:
        monkeypatch.setenv("EL_ARTIFACTS_DIR", tmpdir)
        # Reload module to pick up new env var
        import importlib

        import runit.artifacts

        importlib.reload(runit.artifacts)
        yield Path(tmpdir)


def test_save_artifact_text(temp_artifacts_dir):
    """Test saving text artifact."""
    path = save_artifact("test.txt", "Hello World")

    assert Path(path).exists()
    assert Path(path).read_text() == "Hello World"
    assert Path(path).parent == temp_artifacts_dir


def test_save_artifact_bytes(temp_artifacts_dir):
    """Test saving binary artifact."""
    data = b"\x00\x01\x02\x03"
    path = save_artifact("test.bin", data)

    assert Path(path).exists()
    assert Path(path).read_bytes() == data


def test_save_json_helper(temp_artifacts_dir):
    """Test save_json convenience function."""
    data = {"name": "ACME", "count": 42, "active": True}
    path = save_json("data.json", data)

    assert Path(path).exists()
    loaded = json.loads(Path(path).read_text())
    assert loaded == data


def test_save_artifact_creates_directory(monkeypatch):
    """Test that save_artifact creates artifacts directory if missing."""
    with tempfile.TemporaryDirectory() as tmpdir:
        artifacts_dir = Path(tmpdir) / "artifacts"
        monkeypatch.setenv("EL_ARTIFACTS_DIR", str(artifacts_dir))

        # Reload module
        import importlib

        import runit.artifacts

        importlib.reload(runit.artifacts)

        assert not artifacts_dir.exists()

        save_artifact("test.txt", "content")

        assert artifacts_dir.exists()
        assert (artifacts_dir / "test.txt").exists()


def test_save_dataframe_csv(temp_artifacts_dir):
    """Test saving DataFrame as CSV."""
    pd = pytest.importorskip("pandas")

    df = pd.DataFrame({"a": [1, 2, 3], "b": [4, 5, 6]})
    path = save_dataframe(df, "data.csv", format="csv")

    assert Path(path).exists()

    # Read back and verify
    loaded = pd.read_csv(path)
    assert loaded.equals(df)


def test_save_dataframe_json(temp_artifacts_dir):
    """Test saving DataFrame as JSON."""
    pd = pytest.importorskip("pandas")

    df = pd.DataFrame({"a": [1, 2, 3], "b": [4, 5, 6]})
    path = save_dataframe(df, "data.json", format="json")

    assert Path(path).exists()

    # Read back and verify
    loaded = pd.read_json(path)
    assert loaded.equals(df)


def test_save_dataframe_parquet(temp_artifacts_dir):
    """Test saving DataFrame as Parquet."""
    pd = pytest.importorskip("pandas")
    pytest.importorskip("pyarrow")

    df = pd.DataFrame({"a": [1, 2, 3], "b": [4, 5, 6]})
    path = save_dataframe(df, "data.parquet", format="parquet")

    assert Path(path).exists()

    # Read back and verify
    loaded = pd.read_parquet(path)
    assert loaded.equals(df)


def test_save_dataframe_invalid_format(temp_artifacts_dir):
    """Test that invalid format raises ValueError."""
    pd = pytest.importorskip("pandas")

    df = pd.DataFrame({"a": [1, 2, 3]})

    with pytest.raises(ValueError, match="Unsupported format"):
        save_dataframe(df, "data.xyz", format="invalid")


def test_save_dataframe_unsupported_type(temp_artifacts_dir):
    """Test that unsupported DataFrame type raises TypeError."""
    from runit import save_dataframe

    # Try to save a dict (not a DataFrame)
    with pytest.raises(TypeError):
        save_dataframe({"a": [1, 2, 3]}, "data.csv")
