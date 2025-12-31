"""
Syntax Error - Test Fixture

ABOUTME: Python file with syntax error
"""

from fastapi import FastAPI

app = FastAPI()

@app.get("/")
async def root()
    # Missing colon - syntax error
    return {"message": "Hello"}
