"""Unit tests for dependency installation helpers."""

import subprocess

from build.deps import install_dependencies


def test_install_dependencies_missing_requirements(tmp_path):
    logs = []
    requirements_file = tmp_path / "requirements.txt"

    ok = install_dependencies(requirements_file, deps_hash="abc", logs=logs)

    assert ok is True
    assert any("No requirements file" in log for log in logs)


def test_install_dependencies_empty_requirements(tmp_path):
    logs = []
    requirements_file = tmp_path / "requirements.txt"
    requirements_file.write_text("\n  \n")

    ok = install_dependencies(requirements_file, deps_hash="abc", logs=logs)

    assert ok is True
    assert any("Empty requirements.txt" in log for log in logs)


def test_install_dependencies_forbidden_requirements(tmp_path):
    logs = []
    requirements_file = tmp_path / "requirements.txt"
    requirements_file.write_text("--extra-index-url https://example.com\nrequests==2.31.0\n")

    ok = install_dependencies(requirements_file, deps_hash="abc", logs=logs)

    assert ok is False
    assert any("Forbidden pip option: --extra-index-url" in log for log in logs)


def test_install_dependencies_subprocess_success(tmp_path, monkeypatch):
    logs = []
    requirements_file = tmp_path / "requirements.txt"
    requirements_file.write_text("# comment\nrequests==2.31.0\n")

    def fake_run(*args, **kwargs):
        return subprocess.CompletedProcess(args=args[0], returncode=0, stdout="", stderr="")

    monkeypatch.setattr(subprocess, "run", fake_run)

    ok = install_dependencies(requirements_file, deps_hash="abc", logs=logs)

    assert ok is True
    assert any("Installing 1 dependencies..." in log for log in logs)
    assert any("Dependencies installed successfully" in log for log in logs)


def test_install_dependencies_subprocess_failure(tmp_path, monkeypatch):
    logs = []
    requirements_file = tmp_path / "requirements.txt"
    requirements_file.write_text("requests==2.31.0\n")

    def fake_run(*args, **kwargs):
        return subprocess.CompletedProcess(args=args[0], returncode=1, stdout="", stderr="boom")

    monkeypatch.setattr(subprocess, "run", fake_run)

    ok = install_dependencies(requirements_file, deps_hash="abc", logs=logs)

    assert ok is False
    assert any("pip install failed: boom" in log for log in logs)


def test_install_dependencies_timeout(tmp_path, monkeypatch):
    logs = []
    requirements_file = tmp_path / "requirements.txt"
    requirements_file.write_text("requests==2.31.0\n")

    def fake_run(*args, **kwargs):
        raise subprocess.TimeoutExpired(cmd="pip", timeout=5)

    monkeypatch.setattr(subprocess, "run", fake_run)

    ok = install_dependencies(requirements_file, deps_hash="abc", timeout=5, logs=logs)

    assert ok is False
    assert any("pip install timed out after 5s" in log for log in logs)


def test_install_dependencies_unexpected_error(tmp_path, monkeypatch):
    logs = []
    requirements_file = tmp_path / "requirements.txt"
    requirements_file.write_text("requests==2.31.0\n")

    def fake_run(*args, **kwargs):
        raise RuntimeError("unexpected")

    monkeypatch.setattr(subprocess, "run", fake_run)

    ok = install_dependencies(requirements_file, deps_hash="abc", logs=logs)

    assert ok is False
    assert any("pip install error: unexpected" in log for log in logs)


def test_install_dependencies_initializes_logs_when_none(tmp_path, monkeypatch):
    requirements_file = tmp_path / "requirements.txt"
    requirements_file.write_text("requests==2.31.0\n")

    def fake_run(*args, **kwargs):
        return subprocess.CompletedProcess(args=args[0], returncode=0, stdout="", stderr="")

    monkeypatch.setattr(subprocess, "run", fake_run)

    ok = install_dependencies(requirements_file, deps_hash="abc", logs=None)

    assert ok is True
