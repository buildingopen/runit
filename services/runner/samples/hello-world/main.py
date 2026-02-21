"""
Simple Hello World FastAPI app for testing
"""

from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="Hello World API", description="Simple test API", version="1.0.0")


class GreetingRequest(BaseModel):
    name: str


class GreetingResponse(BaseModel):
    message: str


@app.get("/")
async def root():
    """Root endpoint"""
    return {"message": "Hello World"}


@app.post("/greet")
async def greet(req: GreetingRequest) -> GreetingResponse:
    """Greet a user by name"""
    return GreetingResponse(message=f"Hello, {req.name}!")
