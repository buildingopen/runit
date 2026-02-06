# Runtime AI

**Run any FastAPI app in the cloud with zero infrastructure.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Runtime AI is a Modal-based execution platform that lets you upload any FastAPI application as a ZIP file and instantly get shareable API endpoints. It handles dependency installation, OpenAPI detection, secrets management, and artifact storage—so you can focus on building.

## Features

- **ZIP Upload** — Drop a FastAPI project and get running endpoints
- **OpenAPI Detection** — Automatically generates forms from your API schema
- **Secrets Management** — Encrypted storage for API keys and tokens
- **Artifact Storage** — Persist and download files generated during execution
- **Share Links** — Instant public URLs for your endpoints
- **Context System** — Mount external data sources to your runs

## Quick Start

### Prerequisites

- Node.js >= 18.0.0
- Python >= 3.11
- [Modal](https://modal.com) account (for execution runtime)

### Installation

```bash
# Clone the repository
git clone https://github.com/runtime-ai/execution-layer.git
cd runtime-ai

# Install dependencies
npm install

# Set up Python environment for the runner
cd services/runner
python3.11 -m venv venv
source venv/bin/activate
pip install -e ".[dev]"
```

### Configuration

Copy the example environment file and fill in your values:

```bash
cp .env.example .env
```

Required variables:
- `SUPABASE_URL` / `SUPABASE_ANON_KEY` — Database and auth
- `MODAL_TOKEN_ID` / `MODAL_TOKEN_SECRET` — Execution runtime
- `MASTER_ENCRYPTION_KEY` — Secrets encryption

### Running Locally

```bash
# Terminal 1: Web UI
cd apps/web && npm run dev

# Terminal 2: Control Plane API
cd services/control-plane && npm run dev

# Terminal 3: Modal Runner (optional)
cd services/runner && source venv/bin/activate && modal serve src/modal_app.py
```

Open [http://localhost:3000](http://localhost:3000) to access the web interface.

## Architecture

```
runtime-ai/
├── apps/web/              # Next.js frontend
├── packages/
│   ├── openapi-form/      # Form generation from OpenAPI specs
│   ├── shared/            # Shared types and contracts
│   ├── sdk/               # Python SDK for user apps
│   └── ui/                # React component library
├── services/
│   ├── control-plane/     # Hono API backend
│   └── runner/            # Modal execution runtime
└── infra/                 # Infrastructure scripts
```

### How It Works

1. **Upload** — User uploads a ZIP containing a FastAPI app
2. **Build** — Runner installs dependencies and detects the entrypoint
3. **Extract** — OpenAPI schema is parsed to generate endpoint forms
4. **Execute** — Requests run in isolated Modal containers
5. **Share** — Public URLs enable instant sharing

## Documentation

- [Development Setup](docs/DEVELOPMENT_SETUP.md) — Environment configuration
- [Testing Guide](docs/TESTING_GUIDE.md) — Running tests
- [SDK Guide](docs/SDK_GUIDE.md) — Using the Python SDK

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Security

For security issues, please see [SECURITY.md](SECURITY.md).

## License

MIT — see [LICENSE](LICENSE) for details.
