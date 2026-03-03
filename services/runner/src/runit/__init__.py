# ABOUTME: RunIt Python SDK namespace package. Exposes storage module for user code.
# ABOUTME: Usage: from runit import storage; storage.set("key", value); storage.get("key")

from runit._storage import storage

__all__ = ["storage"]
