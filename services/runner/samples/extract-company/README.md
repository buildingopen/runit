# Extract Company - Golden Demo App

This is the canonical demo app for Runtime. It demonstrates all key features in a real-world use case.

## What it does

Extracts company information from any company website URL:

- Fetches the webpage
- Extracts structured data (company name, industry, description)
- Saves results as JSON and CSV artifacts
- Returns structured response

## Features Demonstrated

- **URL input** - Shows how to handle URL parameters
- **Boolean toggle** - Simple extraction vs full browser
- **Structured response** - Pydantic models with OpenAPI schema
- **Artifact creation** - Multiple output formats (JSON, CSV, HTML)
- **Error handling** - Proper HTTP error handling
- **Real-world use case** - Not a toy example

## API Endpoints

### POST /extract_company

Extract company information from a URL.

**Request:**
```json
{
  "url": "https://www.anthropic.com",
  "use_simple_extraction": true
}
```

**Response:**
```json
{
  "url": "https://www.anthropic.com",
  "company": "Anthropic",
  "industry": "Technology",
  "description": "AI safety and research company...",
  "employee_count": null
}
```

**Artifacts:**
- `company.json` - Full company data
- `company.csv` - CSV format for Excel
- `page.html` - Raw HTML (for debugging)

## Running Locally

```bash
pip install -r requirements.txt
uvicorn main:app --reload
```

Visit http://localhost:8000/docs for interactive API documentation.

## Production Enhancements

In a production version, you would:

1. Use an LLM to extract company data more accurately
2. Add retry logic for network requests
3. Support JavaScript-rendered sites (Playwright)
4. Validate and normalize industry categories
5. Enrich data with external APIs (Clearbit, etc.)
6. Add caching to avoid re-fetching the same URL

## Why This is the Golden Demo

This app is used to:

- Design the Run Page UI
- Test context fetch from URL
- Verify artifact download
- Create all screenshots and marketing materials
- Validate share link functionality

Every UI and UX decision should work perfectly with this app.
