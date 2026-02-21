"""
Simple FastAPI test app for validating Modal runtime
"""

from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="Test App", version="1.0.0")


class GreetRequest(BaseModel):
    name: str


class GreetResponse(BaseModel):
    message: str
    success: bool


@app.post("/greet", response_model=GreetResponse)
def greet(request: GreetRequest) -> GreetResponse:
    """Simple greeting endpoint to test execution"""
    return GreetResponse(message=f"Hello, {request.name}! The Modal runtime works!", success=True)


@app.get("/health")
def health():
    """Health check endpoint"""
    return {"status": "healthy", "runtime": "modal"}
