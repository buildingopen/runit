# Runner

Modal-based Python execution runtime for RunIt.

## Features

- Execute FastAPI applications in isolated containers
- Automatic dependency installation from requirements.txt
- OpenAPI schema extraction
- Entrypoint detection
- Secret injection at runtime
- Artifact persistence

## Tech Stack

- [Modal](https://modal.com) — Serverless infrastructure
- [FastAPI](https://fastapi.tiangolo.com) — Target framework
- [uvicorn](https://www.uvicorn.org) — ASGI server

## Development

```bash
# Create virtual environment
python3.11 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -e ".[dev]"

# Run tests
pytest

# Start local Modal server
modal serve src/modal_app.py

# Deploy to Modal
modal deploy src/modal_app.py
```

## Environment Variables

```bash
MODAL_TOKEN_ID=...
MODAL_TOKEN_SECRET=...
```

## Architecture

```
src/
├── modal_app.py      # Modal app definition
├── build/            # Dependency installation
├── execute/          # Request execution
├── openapi/          # Schema extraction
│   ├── extractor.py  # OpenAPI parsing
│   └── detect.py     # Entrypoint detection
└── errors/           # Error taxonomy

sdk/                  # Python SDK for user apps
samples/              # Example FastAPI applications
tests/                # Unit and integration tests
```

## How It Works

1. **Upload** — ZIP file received from control-plane
2. **Build** — Dependencies installed in container
3. **Extract** — OpenAPI schema parsed from FastAPI app
4. **Execute** — Requests routed to user endpoints
5. **Collect** — Logs and artifacts returned to control-plane
