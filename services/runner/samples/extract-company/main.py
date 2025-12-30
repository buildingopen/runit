"""
Extract Company Demo - Golden sample app for Execution Layer.

Demonstrates:
- URL input
- Boolean toggle
- Structured JSON response
- Artifact creation (CSV)
- Context usage
- Real-world use case
"""

from fastapi import FastAPI
from pydantic import BaseModel, HttpUrl, Field
import httpx
from bs4 import BeautifulSoup
import sys
from pathlib import Path

# Add SDK to path (for local development)
sdk_path = Path(__file__).parent.parent.parent / "sdk"
if sdk_path.exists():
    sys.path.insert(0, str(sdk_path))

from execution_layer import save_artifact, save_dataframe, save_json

app = FastAPI(
    title="Extract Company",
    description="Extract company information from a URL",
    version="1.0.0"
)


class ExtractRequest(BaseModel):
    """Request to extract company information."""

    url: HttpUrl = Field(
        ...,
        description="Company website URL",
        examples=["https://www.anthropic.com"]
    )
    use_simple_extraction: bool = Field(
        default=True,
        description="Use simple HTML extraction (vs full browser)"
    )


class CompanyInfo(BaseModel):
    """Extracted company information."""

    url: str = Field(..., description="Source URL")
    company: str = Field(..., description="Company name")
    industry: str = Field(..., description="Industry category")
    description: str = Field(..., description="Company description")
    employee_count: int | None = Field(None, description="Estimated employee count")


@app.post("/extract_company", response_model=CompanyInfo)
async def extract_company(req: ExtractRequest) -> CompanyInfo:
    """
    Extract company information from a URL.

    This endpoint:
    1. Fetches the webpage
    2. Extracts structured company data
    3. Saves results as JSON and CSV artifacts
    4. Returns structured response
    """

    # Fetch webpage
    async with httpx.AsyncClient(follow_redirects=True, timeout=10.0) as client:
        response = await client.get(str(req.url))
        response.raise_for_status()
        html = response.text

    # Extract data (simplified for demo - real version would use LLM)
    soup = BeautifulSoup(html, 'html.parser')

    # Extract title
    title = soup.find('title')
    title_text = title.text if title else "Unknown Company"

    # Extract meta description
    meta_desc = soup.find('meta', attrs={'name': 'description'})
    description = meta_desc.get('content', '') if meta_desc else "No description available"

    # Simple extraction (in production, use LLM for better accuracy)
    company_info = {
        "url": str(req.url),
        "company": title_text.split('-')[0].strip() if '-' in title_text else title_text,
        "industry": "Technology",  # Would be extracted via LLM
        "description": description[:200],  # Truncate for demo
        "employee_count": None  # Would be extracted via LLM or API
    }

    # Save as JSON artifact
    save_json("company.json", company_info)

    # Save as CSV artifact (for easy Excel import)
    try:
        import pandas as pd
        df = pd.DataFrame([company_info])
        save_dataframe(df, "company.csv", format="csv")
    except ImportError:
        # If pandas not available, save simple CSV
        csv_content = "url,company,industry,description,employee_count\n"
        csv_content += f'"{company_info["url"]}","{company_info["company"]}","{company_info["industry"]}","{company_info["description"]}",{company_info["employee_count"] or ""}\n'
        save_artifact("company.csv", csv_content)

    # Save raw HTML for debugging (owner-only)
    save_artifact("page.html", html[:10000])  # First 10KB

    return CompanyInfo(**company_info)


@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "service": "Extract Company",
        "status": "ready",
        "version": "1.0.0"
    }
