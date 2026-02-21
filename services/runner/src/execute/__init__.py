"""Execute module - In-process endpoint execution"""

from .executor import ExecutionError, execute_endpoint

__all__ = ["execute_endpoint", "ExecutionError"]
