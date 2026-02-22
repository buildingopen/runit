"""
Runtime SDK - Simple utilities for apps running on Runtime.

Provides easy access to:
- Secrets (via environment variables)
- Context (uploaded JSON data)
- Artifact saving (write outputs)
"""

from .artifacts import save_artifact, save_dataframe, save_json
from .context import context

__version__ = "0.1.0"
__all__ = ["context", "save_artifact", "save_dataframe", "save_json"]
