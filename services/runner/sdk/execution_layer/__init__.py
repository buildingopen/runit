"""
Execution Layer SDK - Simple utilities for FastAPI apps running on Execution Layer.

Provides easy access to:
- Secrets (via environment variables)
- Context (uploaded JSON data)
- Artifact saving (write outputs)
"""

from .context import context
from .artifacts import save_artifact, save_dataframe, save_json

__version__ = "0.1.0"
__all__ = ["context", "save_artifact", "save_dataframe", "save_json"]
