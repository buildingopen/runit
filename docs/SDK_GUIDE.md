# RunIt SDK Guide

The RunIt Python SDK lets you write functions that become live web apps.

## Installation

The SDK is automatically available in the runtime environment. For local development:

```bash
cd services/runner/sdk
pip install -e .
```

Or (once published):

```bash
pip install runit
```

## Quick Start

```python
from runit import app, remember

@app.action
def greet(name: str) -> dict:
    visits = (remember("visits") or 0) + 1
    remember("visits", visits)
    return {"message": f"Hello, {name}! Visit #{visits}"}
```

That's it. RunIt extracts the type hints, generates a web form, and runs the function in a Docker sandbox.

## Core Concepts

### 1. Actions (`@app.action`)

Mark functions as RunIt actions:

```python
from runit import app

@app.action
def analyze(text: str, max_words: int = 100) -> dict:
    words = text.split()[:max_words]
    return {"word_count": len(words), "words": words}
```

Type hints determine the auto-generated form:
- `str` becomes a text input
- `int`, `float` become number inputs
- `bool` becomes a checkbox
- Default values become optional fields

You can also specify a custom name:

```python
@app.action(name="custom_name")
def my_func(x: int) -> dict:
    return {"result": x * 2}
```

If no `@app.action` decorators are found, RunIt auto-detects all public functions as a fallback.

### 2. Memory (`remember` / `forget`)

Persistent key-value storage across runs:

```python
from runit import remember, forget

# Store a value
remember("username", "Alice")

# Recall a value (returns None if not found)
name = remember("username")  # "Alice"

# Delete a value
forget("username")
```

`remember()` with one arg reads, with two args writes. Values are JSON-serialized automatically.

### 3. Storage (advanced)

For more control, use the `storage` client directly:

```python
from runit import storage

storage.set("key", {"complex": "value"})
value = storage.get("key")
storage.delete("key")
exists = storage.exists("key")
keys = storage.list()
```

Limits: 10MB per value, 100MB per project.

### 4. Artifacts

Save output files that users can download:

```python
from runit import save_artifact, save_json, save_dataframe

# Save any file
save_artifact("output.txt", "Hello World")
save_artifact("image.png", image_bytes)

# Save JSON (convenience wrapper)
save_json("result.json", {"status": "success", "items": [1, 2, 3]})

# Save DataFrames (pandas or polars)
import pandas as pd
df = pd.DataFrame({"name": ["Alice", "Bob"], "score": [95, 87]})
save_dataframe(df, "scores.csv")
save_dataframe(df, "scores.xlsx", format="excel")
save_dataframe(df, "scores.parquet", format="parquet")
```

### 5. Context

Access secrets and uploaded context data:

```python
from runit import context

# Get a secret (injected as SECRET_* env var)
api_key = context.get_secret("OPENAI_API_KEY")

# Get uploaded context (JSON files at /context/)
company = context.get_context("company")

# List and check contexts
names = context.list_contexts()
if context.has_context("config"):
    config = context.get_context("config")
```

## Complete Examples

### Meeting Prep Tool

```python
from runit import app, remember

@app.action
def meeting_prep(person: str, company: str = "") -> dict:
    """Prepare a brief for a meeting."""
    # Track how many times we've prepped for this person
    key = f"meetings_{person.lower().replace(' ', '_')}"
    count = (remember(key) or 0) + 1
    remember(key, count)

    return {
        "person": person,
        "company": company,
        "meeting_number": count,
        "brief": f"Meeting #{count} with {person}" + (f" from {company}" if company else "")
    }
```

### Data Processor with Artifacts

```python
from runit import app, save_json, save_dataframe
import pandas as pd

@app.action
def analyze_sales(region: str, year: int = 2026) -> dict:
    """Analyze sales data for a region."""
    # Your analysis logic here
    data = [
        {"month": "Jan", "sales": 1200},
        {"month": "Feb", "sales": 1500},
        {"month": "Mar", "sales": 1350},
    ]

    df = pd.DataFrame(data)
    save_dataframe(df, "sales_report.csv")
    save_json("summary.json", {"region": region, "year": year, "total": sum(d["sales"] for d in data)})

    return {"region": region, "total_sales": sum(d["sales"] for d in data)}
```

### API Integration with Secrets

```python
from runit import app, context, save_json
import httpx

@app.action
def enrich_company(company_name: str) -> dict:
    """Look up company information."""
    api_key = context.get_secret("API_KEY")
    if not api_key:
        return {"error": "API_KEY secret required. Add it in project settings."}

    # Call external API
    response = httpx.get(
        "https://api.example.com/companies",
        params={"name": company_name},
        headers={"Authorization": f"Bearer {api_key}"}
    )
    data = response.json()
    save_json("company.json", data)
    return data
```

## Environment Variables

The platform provides these in the runtime container:

| Variable | Description |
|----------|-------------|
| `EL_CONTEXT_DIR` | Context files directory (`/context`) |
| `EL_ARTIFACTS_DIR` | Artifacts output directory (`/artifacts`) |
| `RUNIT_STORAGE_DIR` | Storage directory (`/storage`) |
| `EL_PROJECT_ID` | Project identifier |
| `EL_RUN_ID` | Current run identifier |
| `SECRET_*` | User-configured secrets |

## API Reference

### App

| Function | Description |
|----------|-------------|
| `@app.action` | Mark function as a RunIt action |
| `@app.action(name="x")` | Mark with custom name |
| `app.actions` | List of registered action functions |

### Storage

| Function | Description |
|----------|-------------|
| `remember(key, value)` | Store a value |
| `remember(key)` | Recall a value (returns None if not found) |
| `forget(key)` | Delete a stored value |
| `storage.set(key, value)` | Store (advanced) |
| `storage.get(key, default)` | Retrieve (advanced) |
| `storage.delete(key)` | Delete (advanced) |
| `storage.exists(key)` | Check existence |
| `storage.list()` | List all keys |

### Artifacts

| Function | Description |
|----------|-------------|
| `save_artifact(filename, data)` | Save any file (text or bytes) |
| `save_json(filename, data)` | Save JSON data |
| `save_dataframe(df, filename, format)` | Save DataFrame (csv, json, parquet, excel) |

### Context

| Function | Description |
|----------|-------------|
| `context.get_secret(key)` | Get secret (without `SECRET_` prefix) |
| `context.get_context(name)` | Get uploaded context JSON |
| `context.list_contexts()` | List context names |
| `context.has_context(name)` | Check if context exists |
