"""
Slow Import - Test Fixture

ABOUTME: FastAPI app with slow import (for timeout testing)
"""

import time
from fastapi import FastAPI

# Simulate slow import (e.g., heavy ML library)
time.sleep(35)  # Exceeds 30s timeout

app = FastAPI(title="Slow Import App")


@app.get("/")
async def root():
    return {"message": "This took too long to import"}
