"""
ABOUTME: Dependency installer - Validates and installs pip requirements
ABOUTME: Enforces security policies (no git+ssh, no custom index URLs)
"""

import subprocess
import sys
from pathlib import Path
from typing import List, Optional


class DepsInstallError(Exception):
    """Raised when requirements contain forbidden dependency declarations."""


def validate_requirements(requirements: str) -> None:
    """
    Validate requirements content against forbidden patterns.

    Raises:
        DepsInstallError: If one or more forbidden patterns are found.
    """
    forbidden_patterns = [
        ("git+ssh://", "Forbidden dependency source: git+ssh"),
        ("git+https://", "Forbidden dependency source: git+https"),
        ("git+http://", "Forbidden dependency source: git+http"),
        ("--extra-index-url", "Forbidden pip option: --extra-index-url"),
        ("--index-url", "Forbidden pip option: --index-url"),
        ("--find-links", "Forbidden pip option: --find-links"),
        ("--trusted-host", "Forbidden pip option: --trusted-host"),
        ("-r ", "Forbidden pip option: requirements include (-r)"),
        ("-c ", "Forbidden pip option: constraints include (-c)"),
        ("file://", "Forbidden dependency source: file://"),
    ]

    lowered = requirements.lower()
    for needle, msg in forbidden_patterns:
        if needle in lowered:
            raise DepsInstallError(msg)


def install_dependencies(
    requirements_file: Path,
    deps_hash: str,
    timeout: int = 300,
    logs: Optional[List[str]] = None,
) -> bool:
    """
    Install Python dependencies from a requirements file.

    Args:
        requirements_file: Path to requirements.txt
        deps_hash: Hash of dependencies for caching
        timeout: Max install time in seconds
        logs: List to append log messages to

    Returns:
        True if installation succeeded or was skipped, False on failure
    """
    if logs is None:
        logs = []

    def log(msg: str):
        logs.append(f"[deps] {msg}")

    if not requirements_file.exists():
        log("No requirements file found, skipping dependency install")
        return True

    requirements = requirements_file.read_text().strip()
    if not requirements:
        log("Empty requirements.txt, skipping")
        return True

    try:
        validate_requirements(requirements)
    except DepsInstallError as e:
        log(str(e))
        return False

    req_lines = [
        l.strip()
        for l in requirements.split("\n")
        if l.strip() and not l.strip().startswith("#")
    ]

    if not req_lines:
        log("No actual requirements after filtering comments, skipping")
        return True

    log(f"Installing {len(req_lines)} dependencies...")

    try:
        result = subprocess.run(
            [sys.executable, "-m", "pip", "install", "-r", str(requirements_file), "--quiet"],
            timeout=timeout,
            capture_output=True,
            text=True,
        )

        if result.returncode != 0:
            log(f"pip install failed: {result.stderr.strip()}")
            return False

        log("Dependencies installed successfully")
        return True

    except subprocess.TimeoutExpired:
        log(f"pip install timed out after {timeout}s")
        return False
    except Exception as e:
        log(f"pip install error: {e}")
        return False
