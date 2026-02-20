<div align="center">

# Runtime AI

### Deploy any Python API to the cloud in 30 seconds

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python-3.11+-green?logo=python)](https://www.python.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green?logo=node.js)](https://nodejs.org/)
[![Modal](https://img.shields.io/badge/Powered%20by-Modal-purple)](https://modal.com)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

**Zero infrastructure. Zero Docker. Zero config.**

Upload a FastAPI app → Get a live API endpoint instantly.

[Getting Started](#-quick-start) · [Documentation](#-documentation) · [Examples](#-examples) · [Contributing](#contributing)

</div>

---

## What is Runtime AI?

Runtime AI is an **open-source serverless platform** that deploys Python APIs without infrastructure management. Think Vercel for Python backends, or a self-hostable alternative to Modal/Railway.

```bash
# Upload any FastAPI app
curl -X POST https://api.runtime.ai/projects \
  -F "zip=@my-api.zip" \
  -F "name=my-api"

# Get a live endpoint instantly
# → https://api.runtime.ai/run/my-api/predict
```

## Why Runtime AI?

| Challenge | Runtime AI Solution |
|-----------|-------------------|
| "I just want to deploy my Python API" | ZIP upload → running API in 30s |
| "Docker/K8s is overkill for my use case" | Zero containers to manage |
| "I need GPU for ML inference" | One-click GPU/CPU lane selection |
| "Managing secrets is painful" | Built-in encrypted secrets vault |
| "I want to share my API instantly" | Public share links with rate limiting |

## Features

- **🚀 Instant Deployment** — Upload ZIP, get endpoints. No Docker, no YAML, no CI/CD.
- **📋 Auto-Generated UI** — Forms generated from your OpenAPI schema automatically.
- **🔐 Secrets Management** — AES-256-GCM encrypted storage for API keys and tokens.
- **📁 Artifact Storage** — Persist files (images, PDFs, CSVs) from your runs.
- **🔗 Share Links** — Instant public URLs with built-in rate limiting.
- **🌐 Context System** — Mount external URLs, PDFs, or APIs as context for your runs.
- **⚡ GPU Support** — Run ML models on GPU with zero config changes.
- **📊 Built-in Metrics** — Prometheus endpoint for monitoring.

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.11+
- [Modal](https://modal.com) account (free tier works)

### 1. Clone and Install

```bash
git clone https://github.com/federicodeponte/runtime-ai.git
cd runtime-ai
npm install
```

### 2. Set Up Python Environment

```bash
cd services/runner
python3.11 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -e ".[dev]"
```

### 3. Configure Environment

```bash
cp .env.example .env
```

Required environment variables:

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anonymous key |
| `MODAL_TOKEN_ID` | Modal API token ID |
| `MODAL_TOKEN_SECRET` | Modal API token secret |
| `MASTER_ENCRYPTION_KEY` | 32-byte base64 key for secrets encryption |
| `SENTRY_DSN` | Sentry DSN for error tracking (production) |

Generate an encryption key:
```bash
openssl rand -base64 32
```

### 4. Start Development Servers

```bash
# Terminal 1: Web UI (Next.js)
cd apps/web && npm run dev

# Terminal 2: Control Plane API (Hono)
cd services/control-plane && npm run dev

# Terminal 3: Modal Runtime (optional, for execution)
cd services/runner && modal serve src/modal_app.py
```

Open [http://localhost:3000](http://localhost:3000)

## Quality Gates

Run the full local quality gate before opening or merging a PR:

```bash
npm run verify
```

Current enforced minimums:

- `services/runner` Python coverage: **77%**
- `services/runner/sdk` Python coverage: **77%**

CI fails on:

- lint errors
- test failures
- build failures
- coverage below thresholds (runner + sdk)

## Examples

### Example 1: Simple Prediction API

```python
# main.py
from fastapi import FastAPI

app = FastAPI()

@app.post("/predict")
def predict(text: str):
    # Your ML model here
    return {"prediction": "positive", "confidence": 0.95}
```

```bash
# Deploy
zip -r my-api.zip main.py requirements.txt
curl -X POST http://localhost:3001/projects -F "zip=@my-api.zip"
```

### Example 2: Image Processing with GPU

```python
# main.py
from fastapi import FastAPI, UploadFile
from runtime_ai import gpu_required

app = FastAPI()

@app.post("/process-image")
@gpu_required  # Automatically routes to GPU lane
async def process_image(file: UploadFile):
    # GPU-accelerated processing
    return {"processed": True}
```

### Example 3: Using Secrets

```python
# main.py
import os
from fastapi import FastAPI

app = FastAPI()

@app.get("/fetch-data")
def fetch_data():
    api_key = os.environ.get("MY_API_KEY")  # Injected at runtime
    # Use your secret API key
    return {"status": "ok"}
```

Store secrets via the API:
```bash
curl -X POST http://localhost:3001/projects/{id}/secrets \
  -H "Content-Type: application/json" \
  -d '{"key": "MY_API_KEY", "value": "sk-..."}'
```

## Architecture

```
runtime-ai/
├── apps/
│   └── web/                 # Next.js frontend
├── packages/
│   ├── openapi-form/        # Auto-generate forms from OpenAPI
│   ├── shared/              # TypeScript types & contracts
│   ├── sdk/                 # Python SDK
│   └── ui/                  # React component library
├── services/
│   ├── control-plane/       # Hono.js API (auth, projects, secrets)
│   └── runner/              # Modal execution runtime
└── infra/                   # Deployment scripts
```

### How It Works

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────┐
│   Web UI    │────▶│  Control Plane  │────▶│    Modal    │
│  (Next.js)  │     │    (Hono.js)    │     │  (Runtime)  │
└─────────────┘     └─────────────────┘     └─────────────┘
                            │
                    ┌───────┴───────┐
                    │   Supabase    │
                    │  (Database)   │
                    └───────────────┘
```

1. **Upload** — User uploads ZIP with FastAPI app
2. **Parse** — Control plane extracts OpenAPI schema
3. **Deploy** — Modal builds the execution environment
4. **Execute** — Requests run in isolated containers
5. **Share** — Generate public URLs for endpoints

## API Reference

### Projects

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/projects` | GET | List all projects |
| `/projects` | POST | Create project from ZIP |
| `/projects/:id` | GET | Get project details |
| `/projects/:id` | DELETE | Delete project |
| `/projects/:id/endpoints` | GET | List endpoints |

### Runs

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/runs` | POST | Execute an endpoint |
| `/runs/:id` | GET | Get run status/result |

### Secrets

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/projects/:id/secrets` | POST | Create secret |
| `/projects/:id/secrets` | GET | List secrets (masked) |
| `/projects/:id/secrets/:key` | PUT | Update secret |
| `/projects/:id/secrets/:key` | DELETE | Delete secret |

Full OpenAPI spec available at `/openapi.json`

## Comparison

| Feature | Runtime AI | Modal | Railway | Vercel |
|---------|-----------|-------|---------|--------|
| Python API deployment | ✅ | ✅ | ✅ | ❌ |
| ZIP upload | ✅ | ❌ | ❌ | ❌ |
| Auto-generated UI | ✅ | ❌ | ❌ | ❌ |
| GPU support | ✅ | ✅ | ❌ | ❌ |
| Self-hostable | ✅ | ❌ | ❌ | ❌ |
| Built-in secrets | ✅ | ✅ | ✅ | ✅ |
| Share links | ✅ | ❌ | ❌ | ❌ |
| Open source | ✅ | ❌ | ❌ | ❌ |

## FAQ

<details>
<summary><strong>What Python frameworks are supported?</strong></summary>

Currently FastAPI. Flask and Django support is planned.
</details>

<details>
<summary><strong>How is this different from Modal?</strong></summary>

Runtime AI uses Modal as the execution backend but adds: ZIP upload, auto-generated UIs, share links, and a complete project management layer. Think of it as a platform built on top of Modal.
</details>

<details>
<summary><strong>Can I self-host this?</strong></summary>

Yes! Runtime AI is fully open source. You need Supabase (or compatible Postgres) and a Modal account.
</details>

<details>
<summary><strong>How are secrets stored?</strong></summary>

Secrets are encrypted with AES-256-GCM using a master key. The plaintext never hits the database.
</details>

<details>
<summary><strong>Is there GPU support?</strong></summary>

Yes. Add `lane: "gpu"` to your run request or use the `@gpu_required` decorator.
</details>

<details>
<summary><strong>What's the cold start time?</strong></summary>

First run: 10-30s (dependency installation). Subsequent runs: <1s (warm container).
</details>

<details>
<summary><strong>How do I monitor my APIs?</strong></summary>

Prometheus metrics are exposed at `/metrics`. Integrate with Grafana for dashboards.
</details>

## Documentation

- [Development Setup](docs/DEVELOPMENT_SETUP.md) — Local environment configuration
- [Testing Guide](docs/TESTING_GUIDE.md) — Running the test suite
- [SDK Guide](docs/SDK_GUIDE.md) — Using the Python SDK in your apps
- [Deployment Guide](docs/DEPLOYMENT.md) — Production deployment
- [Security](SECURITY.md) — Security policies and reporting

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

```bash
# Run tests
npm test

# Run linting
npm run lint

# Build
npm run build
```

## Roadmap

- [ ] Flask/Django support
- [ ] GitHub integration (deploy from repo)
- [ ] Custom domains
- [ ] Team workspaces
- [ ] Usage analytics dashboard
- [ ] WebSocket support

## Community

- [GitHub Discussions](https://github.com/federicodeponte/runtime-ai/discussions) — Questions and ideas
- [GitHub Issues](https://github.com/federicodeponte/runtime-ai/issues) — Bug reports

## Security

For security issues, please email security@runtime.ai or see [SECURITY.md](SECURITY.md).

## License

MIT License — see [LICENSE](LICENSE) for details.

---

<div align="center">

**If Runtime AI helps you, consider giving it a ⭐**

[⬆ Back to top](#runtime-ai)

</div>
