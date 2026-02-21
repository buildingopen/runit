"""Tests for error taxonomy classification."""

from errors.taxonomy import ERROR_TAXONOMY, classify_error


def test_classify_circular_import():
    e = ImportError("circular import detected in module foo")
    result = classify_error(e)
    assert result["error_class"] == "CIRCULAR_IMPORT"


def test_classify_import_error():
    e = ImportError("No module named 'nonexistent'")
    result = classify_error(e)
    assert result["error_class"] == "IMPORT_ERROR"


def test_classify_timeout():
    e = TimeoutError("timed out")
    result = classify_error(e)
    assert result["error_class"] == "TIMEOUT"


def test_classify_import_timeout():
    e = Exception("import timeout during startup")
    result = classify_error(e)
    assert result["error_class"] == "IMPORT_TIMEOUT"


def test_classify_memory_error():
    e = MemoryError("out of memory")
    result = classify_error(e)
    assert result["error_class"] == "OUT_OF_MEMORY"


def test_classify_memory_keyword():
    e = RuntimeError("Exceeded memory limit")
    result = classify_error(e)
    assert result["error_class"] == "OUT_OF_MEMORY"


def test_classify_validation_error():
    e = ValueError("pydantic validation failed")
    result = classify_error(e)
    assert result["error_class"] == "REQUEST_VALIDATION_FAILED"


def test_classify_network_policy():
    e = ConnectionError("network blocked by policy")
    result = classify_error(e)
    assert result["error_class"] == "NETWORK_POLICY_VIOLATION"


def test_classify_network_failed():
    e = ConnectionError("network connection refused")
    result = classify_error(e)
    assert result["error_class"] == "NETWORK_FAILED"


def test_classify_lifespan_failed():
    e = RuntimeError("lifespan handler crashed")
    result = classify_error(e)
    assert result["error_class"] == "LIFESPAN_FAILED"


def test_classify_python_version():
    e = RuntimeError("python version mismatch: requires 3.12")
    result = classify_error(e)
    assert result["error_class"] == "PYTHON_VERSION_MISMATCH"


def test_classify_missing_library():
    e = OSError("libfoo.so not found")
    result = classify_error(e)
    assert result["error_class"] == "MISSING_SYSTEM_LIBRARY"


def test_classify_disk_full():
    e = OSError("disk space quota exceeded")
    result = classify_error(e)
    assert result["error_class"] == "FILE_SYSTEM_FULL"


def test_classify_unknown_falls_to_runtime_crash():
    e = RuntimeError("something unexpected")
    result = classify_error(e)
    assert result["error_class"] == "RUNTIME_CRASH"
    assert "suggested_fix" in result
    assert "message" in result


def test_error_taxonomy_has_all_required_fields():
    for key, entry in ERROR_TAXONOMY.items():
        assert "message" in entry, f"{key} missing message"
        assert "suggested_fix" in entry, f"{key} missing suggested_fix"
