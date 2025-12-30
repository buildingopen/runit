# Execution Layer SDK

Simple utilities for building FastAPI apps on Execution Layer.

## Installation

The SDK is automatically available in the Execution Layer runtime. For local development:

```bash
pip install -e .
```

Or install from PyPI (when published):

```bash
pip install execution-layer
```

## Quick Start

```python
from fastapi import FastAPI
from execution_layer import context, save_artifact

app = FastAPI()

@app.post("/process")
async def process(data: dict):
    # Access secrets
    api_key = context.get_secret("OPENAI_API_KEY")

    # Access uploaded context
    company = context.get_context("company")

    # Save results
    save_artifact("output.json", json.dumps(result))

    return {"status": "success"}
```

## Features

- **Context Access** - Read secrets and uploaded JSON data
- **Artifact Saving** - Write outputs that users can download
- **DataFrame Export** - Save pandas/polars DataFrames in multiple formats
- **Zero Dependencies** - Core functionality has no required dependencies

## Documentation

See the [SDK Guide](../../../docs/SDK_GUIDE.md) for complete documentation and examples.

## Sample Apps

Check out the sample apps in `../samples/`:

- `extract-company` - URL scraping with artifacts
- `image-analysis` - File upload and image processing
- `bulk-processor` - Batch processing with error handling

## Development

```bash
# Install with dev dependencies
pip install -e ".[dev]"

# Run tests
pytest

# Run tests with coverage
pytest --cov=execution_layer --cov-report=html
```

## License

MIT
