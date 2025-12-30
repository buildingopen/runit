"""
Broken Import - Test Fixture

ABOUTME: FastAPI app with import error
"""

from fastapi import FastAPI

# This will cause an import error
from nonexistent_module import something  # noqa: F401

app = FastAPI()


@app.get("/")
async def root():
    return {"message": "Hello"}
