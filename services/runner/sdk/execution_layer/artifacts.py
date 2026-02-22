"""
Artifact writing utilities for Runtime.

Provides helpers to save outputs that users can download:
- save_artifact(): Save any file (text, binary, JSON)
- save_dataframe(): Save pandas/polars DataFrames in various formats
"""

import json
import os
from pathlib import Path
from typing import Any, Literal

# Get artifacts directory from environment
ARTIFACTS_DIR = Path(os.getenv("EL_ARTIFACTS_DIR", "/artifacts"))


def save_artifact(filename: str, data: bytes | str) -> str:
    """
    Save artifact and return path.

    Artifacts are collected from /artifacts/ and made available for download.

    Args:
        filename: Name of the file to save
        data: File content (string or bytes)

    Returns:
        Absolute path to saved file

    Examples:
        >>> from execution_layer import save_artifact
        >>>
        >>> # Save text file
        >>> save_artifact("output.txt", "Hello World")
        >>>
        >>> # Save JSON
        >>> import json
        >>> save_artifact("data.json", json.dumps({"key": "value"}))
        >>>
        >>> # Save binary data
        >>> save_artifact("image.png", image_bytes)
    """
    # Ensure artifacts directory exists
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)

    # Build full path
    path = ARTIFACTS_DIR / filename

    # Write data
    if isinstance(data, str):
        path.write_text(data, encoding="utf-8")
    else:
        path.write_bytes(data)

    return str(path)


def save_dataframe(
    df: Any, filename: str, format: Literal["csv", "json", "parquet", "excel"] = "csv"
) -> str:
    """
    Save pandas or polars DataFrame as artifact.

    Args:
        df: DataFrame to save (pandas or polars)
        filename: Name of the file to save
        format: Output format - "csv", "json", "parquet", or "excel"

    Returns:
        Absolute path to saved file

    Examples:
        >>> import pandas as pd
        >>> from execution_layer import save_dataframe
        >>>
        >>> df = pd.DataFrame({"a": [1, 2, 3], "b": [4, 5, 6]})
        >>>
        >>> # Save as CSV
        >>> save_dataframe(df, "output.csv")
        >>>
        >>> # Save as JSON
        >>> save_dataframe(df, "output.json", format="json")
        >>>
        >>> # Save as Parquet
        >>> save_dataframe(df, "output.parquet", format="parquet")
    """
    # Ensure artifacts directory exists
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)

    # Build full path
    path = ARTIFACTS_DIR / filename

    # Try to detect DataFrame type and save accordingly
    df_type = type(df).__name__

    if format == "csv":
        if hasattr(df, "to_csv"):
            df.to_csv(path, index=False)
        else:
            raise TypeError(f"DataFrame type {df_type} does not support CSV export")

    elif format == "json":
        if hasattr(df, "to_json"):
            df.to_json(path, orient="records", indent=2)
        else:
            raise TypeError(f"DataFrame type {df_type} does not support JSON export")

    elif format == "parquet":
        if hasattr(df, "to_parquet"):
            df.to_parquet(path)
        else:
            raise TypeError(f"DataFrame type {df_type} does not support Parquet export")

    elif format == "excel":
        if hasattr(df, "to_excel"):
            df.to_excel(path, index=False)
        else:
            raise TypeError(f"DataFrame type {df_type} does not support Excel export")

    else:
        raise ValueError(f"Unsupported format: {format}")

    return str(path)


def save_json(filename: str, data: Any) -> str:
    """
    Save data as JSON artifact.

    Convenience wrapper around save_artifact() for JSON data.

    Args:
        filename: Name of the file to save
        data: Any JSON-serializable data

    Returns:
        Absolute path to saved file

    Examples:
        >>> from execution_layer import save_json
        >>>
        >>> save_json("result.json", {"status": "success", "count": 42})
    """
    json_str = json.dumps(data, indent=2, ensure_ascii=False)
    return save_artifact(filename, json_str)
