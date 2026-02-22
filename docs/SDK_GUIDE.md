# Runtime SDK Guide

The Runtime SDK provides simple utilities to make your apps work seamlessly on the platform.

## Installation

The SDK is automatically available in the runtime environment. For local development:

```bash
cd services/runner/sdk
pip install -e .
```

## Quick Start

```python
from fastapi import FastAPI
from execution_layer import context, save_artifact, save_dataframe

app = FastAPI()

@app.post("/process")
async def process_data(input_data: dict):
    # Access secrets
    api_key = context.get_secret("OPENAI_API_KEY")

    # Access uploaded context
    company_data = context.get_context("company")

    # Save results as artifact
    save_artifact("result.json", json.dumps(result))

    return {"status": "success"}
```

## Core Concepts

### 1. Context

Access execution environment data:

#### Secrets

Secrets are injected as environment variables prefixed with `SECRET_`:

```python
from execution_layer import context

# Get a secret
api_key = context.get_secret("OPENAI_API_KEY")
# Looks for SECRET_OPENAI_API_KEY

# Check if secret exists
if api_key:
    # Use the secret
    client = OpenAI(api_key=api_key)
else:
    raise ValueError("OPENAI_API_KEY secret required")
```

**Best practices:**
- Always check if secret exists before using
- Never log or return secrets in responses
- Use descriptive secret names (OPENAI_API_KEY, not KEY1)

#### Context Data

Context files are JSON documents mounted at `/context/`:

```python
from execution_layer import context

# Get context by name
company = context.get_context("company")
if company:
    print(f"Processing {company['name']}")

# List all available contexts
contexts = context.list_contexts()
print(f"Available contexts: {contexts}")

# Check if specific context exists
if context.has_context("user_preferences"):
    prefs = context.get_context("user_preferences")
```

**Context use cases:**
- Company/user metadata
- Configuration data
- Fetched website content
- Reusable reference data

**Context limitations:**
- Read-only (cannot modify)
- Max 1MB per context file
- JSON format only
- Never use context for secrets

### 2. Artifacts

Save outputs that users can download:

#### Basic File Saving

```python
from execution_layer import save_artifact

# Save text file
save_artifact("output.txt", "Hello World")

# Save JSON
import json
data = {"key": "value"}
save_artifact("data.json", json.dumps(data, indent=2))

# Save binary data
save_artifact("image.png", image_bytes)

# Save CSV
csv_content = "name,value\nAlice,100\nBob,200"
save_artifact("data.csv", csv_content)
```

#### JSON Convenience Helper

```python
from execution_layer import save_json

# Automatically formats and saves JSON
save_json("result.json", {
    "status": "success",
    "items": [1, 2, 3]
})
```

#### DataFrame Export

```python
from execution_layer import save_dataframe
import pandas as pd

df = pd.DataFrame({
    "name": ["Alice", "Bob", "Charlie"],
    "score": [95, 87, 92]
})

# Save as CSV (default)
save_dataframe(df, "scores.csv")

# Save as JSON
save_dataframe(df, "scores.json", format="json")

# Save as Parquet
save_dataframe(df, "scores.parquet", format="parquet")

# Save as Excel
save_dataframe(df, "scores.xlsx", format="excel")
```

**Artifact best practices:**
- Use descriptive filenames
- Include file extensions
- Keep artifacts under 50MB total
- Max 50 files per run
- Save both human-readable (JSON/CSV) and machine-readable (Parquet) formats

## Environment Variables

The platform provides these environment variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `EL_CONTEXT_DIR` | Context files directory | `/context` |
| `EL_ARTIFACTS_DIR` | Artifacts output directory | `/artifacts` |
| `EL_PROJECT_ID` | Project identifier | `abc-123-def` |
| `EL_PROJECT_VERSION` | Code version hash | `abc123...` |
| `EL_RUN_ID` | Current run identifier | `run-456-ghi` |
| `SECRET_*` | User secrets | `SECRET_OPENAI_API_KEY` |

## Complete Examples

### Example 1: Company Enrichment

```python
from fastapi import FastAPI
from pydantic import BaseModel
import httpx
from execution_layer import context, save_json, save_dataframe

app = FastAPI()

class EnrichRequest(BaseModel):
    company_name: str

@app.post("/enrich_company")
async def enrich_company(req: EnrichRequest):
    # Get API key from secrets
    api_key = context.get_secret("CLEARBIT_API_KEY")
    if not api_key:
        return {"error": "CLEARBIT_API_KEY required"}

    # Call external API
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"https://company.clearbit.com/v2/companies/find",
            params={"name": req.company_name},
            headers={"Authorization": f"Bearer {api_key}"}
        )
        company_data = response.json()

    # Save results
    save_json("company.json", company_data)

    # Also save as CSV for easy Excel import
    import pandas as pd
    df = pd.DataFrame([company_data])
    save_dataframe(df, "company.csv")

    return company_data
```

### Example 2: Bulk Email Validation

```python
from fastapi import FastAPI
from execution_layer import save_dataframe, save_json
import pandas as pd
import re

app = FastAPI()

@app.post("/validate_emails")
async def validate_emails(emails: list[str]):
    email_regex = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')

    results = []
    for email in emails:
        is_valid = bool(email_regex.match(email))
        results.append({
            "email": email,
            "valid": is_valid,
            "reason": None if is_valid else "Invalid format"
        })

    # Save as DataFrame
    df = pd.DataFrame(results)
    save_dataframe(df, "validation_results.csv")
    save_dataframe(df, "validation_results.xlsx", format="excel")

    # Save summary
    summary = {
        "total": len(emails),
        "valid": sum(1 for r in results if r["valid"]),
        "invalid": sum(1 for r in results if not r["valid"])
    }
    save_json("summary.json", summary)

    return {
        "summary": summary,
        "results": results
    }
```

### Example 3: Image Processing with Context

```python
from fastapi import FastAPI, UploadFile
from execution_layer import context, save_artifact
from PIL import Image
import io

app = FastAPI()

@app.post("/process_image")
async def process_image(file: UploadFile):
    # Get processing preferences from context
    prefs = context.get_context("image_preferences") or {}
    max_width = prefs.get("max_width", 800)
    quality = prefs.get("quality", 85)

    # Read and process image
    image_data = await file.read()
    image = Image.open(io.BytesIO(image_data))

    # Resize if needed
    if image.width > max_width:
        ratio = max_width / image.width
        new_size = (max_width, int(image.height * ratio))
        image = image.resize(new_size, Image.Resampling.LANCZOS)

    # Save processed image
    output = io.BytesIO()
    image.save(output, format="JPEG", quality=quality)
    save_artifact("processed.jpg", output.getvalue())

    return {
        "original_size": f"{image.width}x{image.height}",
        "quality": quality
    }
```

## Testing Locally

### Setup Test Environment

```bash
# Set up environment variables
export EL_CONTEXT_DIR=./test_context
export EL_ARTIFACTS_DIR=./test_artifacts
export SECRET_OPENAI_API_KEY=sk-test-key

# Create directories
mkdir -p test_context test_artifacts

# Create test context file
echo '{"name": "ACME Inc", "industry": "SaaS"}' > test_context/company.json
```

### Run Tests

```bash
# Install dependencies
pip install -r requirements.txt

# Run the app
uvicorn main:app --reload

# Test endpoint
curl -X POST http://localhost:8000/your_endpoint \
  -H "Content-Type: application/json" \
  -d '{"key": "value"}'

# Check artifacts
ls -lh test_artifacts/
```

## Common Patterns

### Pattern 1: External API Integration

```python
from execution_layer import context, save_json

@app.post("/fetch_data")
async def fetch_data(query: str):
    api_key = context.get_secret("API_KEY")

    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://api.example.com/data",
            headers={"Authorization": f"Bearer {api_key}"},
            params={"q": query}
        )
        data = response.json()

    save_json("response.json", data)
    return data
```

### Pattern 2: Multi-Format Export

```python
from execution_layer import save_json, save_dataframe
import pandas as pd

def export_results(data: list[dict]):
    # Save raw JSON
    save_json("results.json", data)

    # Save as CSV for Excel
    df = pd.DataFrame(data)
    save_dataframe(df, "results.csv")

    # Save as Excel with formatting
    save_dataframe(df, "results.xlsx", format="excel")
```

### Pattern 3: Progressive Enhancement

```python
from execution_layer import context

@app.post("/process")
async def process(data: dict):
    # Basic processing
    result = basic_process(data)

    # Enhanced processing if API key available
    if api_key := context.get_secret("ENHANCEMENT_API_KEY"):
        result = enhance_with_api(result, api_key)

    return result
```

## Troubleshooting

### Secret not found

```python
api_key = context.get_secret("API_KEY")
if not api_key:
    raise ValueError(
        "API_KEY secret required. "
        "Add it in project settings."
    )
```

### Context file missing

```python
if not context.has_context("company"):
    return {
        "error": "company context required",
        "help": "Upload company.json in project settings"
    }
```

### Artifact size limit

```python
data_size = len(data_bytes)
if data_size > 10 * 1024 * 1024:  # 10MB
    # Save compressed version
    import gzip
    compressed = gzip.compress(data_bytes)
    save_artifact("data.json.gz", compressed)
else:
    save_artifact("data.json", data_bytes)
```

## Best Practices

### Security

1. **Never log secrets**
   ```python
   # ❌ Bad
   print(f"Using API key: {api_key}")

   # ✅ Good
   print("Using API key: ***")
   ```

2. **Validate context data**
   ```python
   company = context.get_context("company")
   if company and "name" in company:
       # Safe to use
       process_company(company)
   ```

3. **Handle missing secrets gracefully**
   ```python
   api_key = context.get_secret("OPTIONAL_KEY")
   if api_key:
       # Enhanced features
   else:
       # Fallback to basic features
   ```

### Performance

1. **Cache context lookups**
   ```python
   # Load once at startup
   company = context.get_context("company")

   @app.post("/process")
   async def process():
       # Use cached company data
       return process_with_company(company)
   ```

2. **Stream large artifacts**
   ```python
   # Instead of loading all in memory
   with open("/artifacts/large_file.csv", "w") as f:
       for chunk in generate_data():
           f.write(chunk)
   ```

3. **Use appropriate formats**
   ```python
   # Parquet for large datasets (smaller, faster)
   save_dataframe(large_df, "data.parquet", format="parquet")

   # CSV for small datasets (human-readable)
   save_dataframe(small_df, "summary.csv", format="csv")
   ```

## API Reference

### context.get_secret(key: str) → str | None

Get secret from environment variables.

**Args:**
- `key`: Secret key (without SECRET_ prefix)

**Returns:** Secret value if exists, None otherwise

### context.get_context(name: str) → dict | None

Get uploaded context by name.

**Args:**
- `name`: Context name (without .json extension)

**Returns:** Parsed JSON context if exists, None otherwise

### context.list_contexts() → list[str]

List all available context files.

**Returns:** List of context names (without .json extension)

### context.has_context(name: str) → bool

Check if a context file exists.

**Args:**
- `name`: Context name (without .json extension)

**Returns:** True if context exists, False otherwise

### save_artifact(filename: str, data: bytes | str) → str

Save artifact and return path.

**Args:**
- `filename`: Name of the file to save
- `data`: File content (string or bytes)

**Returns:** Absolute path to saved file

### save_json(filename: str, data: Any) → str

Save data as JSON artifact.

**Args:**
- `filename`: Name of the file to save
- `data`: Any JSON-serializable data

**Returns:** Absolute path to saved file

### save_dataframe(df, filename: str, format: str = "csv") → str

Save pandas or polars DataFrame as artifact.

**Args:**
- `df`: DataFrame to save
- `filename`: Name of the file to save
- `format`: Output format ("csv", "json", "parquet", or "excel")

**Returns:** Absolute path to saved file

## Sample Apps

Explore the sample apps in `services/runner/samples/`:

1. **extract-company** - Golden demo showing URL input, context usage, and artifacts
2. **image-analysis** - File upload handling and image processing
3. **bulk-processor** - Array processing with error handling

Each sample includes:
- Complete working code
- requirements.txt
- README with usage examples
- Production enhancement suggestions

## Need Help?

- Check the sample apps for working examples
- Review error messages carefully (they're designed to be helpful)
- Test locally first with environment variables
- Read the CLAUDE.md for platform architecture

## What's Next?

The SDK is intentionally minimal - just what you need to integrate with the platform. For most use cases, you'll use:

1. `context.get_secret()` - Access API keys
2. `save_artifact()` - Save outputs
3. Standard FastAPI patterns for everything else

Keep it simple, and your app will run great on Runtime.
