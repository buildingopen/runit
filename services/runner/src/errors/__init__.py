"""Errors module - Error classification and messaging"""

from .taxonomy import ERROR_TAXONOMY, classify_error

__all__ = ["classify_error", "ERROR_TAXONOMY"]
