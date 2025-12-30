"""Execute module - In-process endpoint execution"""

from .executor import execute_endpoint, ExecutionError

__all__ = ["execute_endpoint", "ExecutionError"]
