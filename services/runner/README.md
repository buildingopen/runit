# Runner

Docker-based Python execution runtime for RunIt.

## Features

- Execute Python functions in isolated Docker containers
- Automatic dependency installation from requirements.txt
- OpenAPI schema extraction from type hints
- Entrypoint detection
- Secret injection at runtime
- Artifact persistence
- Built-in SDK with `@app.action` decorator and `remember()` storage

## Tech Stack

- [FastAPI](https://fastapi.tiangolo.com) - Target framework
- [uvicorn](https://www.uvicorn.org) - ASGI server
- Docker - Container isolation

## Development

```bash
# Create virtual environment
python3.11 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -e ".[dev]"

# Run tests
pytest
```

## Architecture

```
src/
├── build/            # Dependency installation
├── execute/          # Request execution
├── openapi/          # Schema extraction
│   ├── extractor.py  # OpenAPI parsing
│   └── detect.py     # Entrypoint detection
└── errors/           # Error taxonomy

sdk/                  # Python SDK for user apps
  └── runit/          # @app.action, remember(), storage
samples/              # Example applications
tests/                # Unit and integration tests
```

## How It Works

1. **Upload** - ZIP file received from control-plane
2. **Build** - Dependencies installed in container
3. **Extract** - OpenAPI schema parsed from type hints
4. **Execute** - Requests routed to user functions
5. **Collect** - Logs and artifacts returned to control-plane
