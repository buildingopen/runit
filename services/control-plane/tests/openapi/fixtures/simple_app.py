"""
Simple FastAPI App - Test Fixture

ABOUTME: Basic FastAPI app with a few endpoints for testing
"""

from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="Simple Test App")


class CompanyRequest(BaseModel):
    url: str


class CompanyResponse(BaseModel):
    name: str
    description: str


@app.get("/")
async def root():
    """Root endpoint"""
    return {"message": "Hello World"}


@app.post("/extract_company")
async def extract_company(req: CompanyRequest) -> CompanyResponse:
    """Extract company info from URL"""
    return CompanyResponse(name="ACME Inc", description="Test company")


@app.get("/health")
async def health():
    """Health check"""
    return {"status": "healthy"}
