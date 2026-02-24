"""
Docker entrypoint for the runtime runner.
Reads /workspace/payload.json, calls execute_endpoint(), prints JSON result to stdout.
"""

import json
import sys
import os

# Add /app to path so execution modules are importable
sys.path.insert(0, "/app")

from execute.executor import execute_endpoint

def main():
    payload_path = "/workspace/payload.json"

    if not os.path.exists(payload_path):
        json.dump({
            "run_id": "unknown",
            "status": "error",
            "http_status": 500,
            "response_body": None,
            "duration_ms": 0,
            "error_class": "DOCKER_ENTRYPOINT_ERROR",
            "error_message": f"Payload file not found: {payload_path}",
        }, sys.stdout)
        sys.exit(1)

    try:
        with open(payload_path, "r") as f:
            payload = json.load(f)
    except json.JSONDecodeError as e:
        json.dump({
            "run_id": "unknown",
            "status": "error",
            "http_status": 500,
            "response_body": None,
            "duration_ms": 0,
            "error_class": "DOCKER_ENTRYPOINT_ERROR",
            "error_message": f"Invalid JSON in payload: {e}",
        }, sys.stdout)
        sys.exit(1)

    timeout = min(payload.get("timeout_seconds", 60), 300)  # Cap at 5min for local
    lane = payload.get("lane", "cpu")

    if lane == "gpu":
        json.dump({
            "run_id": payload.get("run_id", "unknown"),
            "status": "error",
            "http_status": 501,
            "response_body": None,
            "duration_ms": 0,
            "error_class": "GPU_NOT_SUPPORTED",
            "error_message": "GPU execution is not available on the Docker backend. Use CPU lane instead.",
            "suggested_fix": "Change the lane to 'cpu' or use the Modal backend for GPU workloads.",
        }, sys.stdout)
        sys.exit(0)

    result = execute_endpoint(
        payload=payload,
        max_timeout=timeout,
        max_memory_mb=4096,
        lane="cpu",
    )
    json.dump(result, sys.stdout)

if __name__ == "__main__":
    main()
