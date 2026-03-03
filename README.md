<div align="center">

# RunIt

### Self-hosted platform for deploying Python APIs

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python-3.11+-green?logo=python)](https://www.python.org/)
[![Docker](https://img.shields.io/badge/Docker-required-blue?logo=docker)](https://www.docker.com/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

Upload Python code, get a running API. Persistent storage, encrypted secrets, versioning, share links.

[Quick Start](#quick-start-self-hosted) · [Storage SDK](#persistent-storage-sdk) · [API Reference](#api-reference) · [Contributing](#contributing)

</div>

---

## Quick Start (Self-Hosted)

Requires: Docker with Docker Compose.

```bash
git clone https://github.com/federicodeponte/runtime-ai.git
cd runtime-ai

# Generate encryption key
export MASTER_ENCRYPTION_KEY=$(openssl rand -base64 32)

# Build and start (builds both server + runner images)
docker-compose up --build -d

# Verify
curl http://localhost:3001/health
```

That's it. The server builds both images (control plane + Python runner), creates SQLite for metadata, and mounts persistent volumes for storage.

### Deploy and run your first API

```bash
# Deploy a FastAPI app
curl -X POST http://localhost:3001/v1/deploy \
  -H "Content-Type: application/json" \
  -d '{
    "code": "from fastapi import FastAPI\n\napp = FastAPI()\n\n@app.get(\"/hello\")\ndef hello():\n    return {\"hello\": \"world\"}",
    "name": "my-api"
  }'
# Response includes project_id, version_id, and endpoints[0].id

# Run the endpoint
curl -X POST http://localhost:3001/v1/runs \
  -H "Content-Type: application/json" \
  -d '{"project_id": "<project_id>", "version_id": "<version_id>", "endpoint_id": "get--hello"}'
# Returns run_id with status "running"

# Get the result (async, poll until status is "success")
curl http://localhost:3001/v1/runs/<run_id>
# {"status": "success", "result": {"json": {"hello": "world"}}}
```

Plain functions with type hints are also auto-detected as POST endpoints:

```bash
curl -X POST http://localhost:3001/v1/deploy \
  -H "Content-Type: application/json" \
  -d '{"code": "def add(x: int, y: int) -> dict:\n    return {\"result\": x + y}", "name": "math-api"}'
```

### Public URL (optional)

Expose your instance to the internet with Cloudflare Tunnel:

```bash
docker-compose --profile tunnel up --build -d
```

## Features

- **Instant Deployment** -- Upload a ZIP or raw Python code, get endpoints.
- **Persistent Storage** -- Key-value store accessible from user code via `from runit import storage`.
- **Secrets Management** -- AES-256-GCM encrypted vault, injected as env vars at runtime.
- **Versioning** -- Multiple versions per project with promote/rollback.
- **Share Links** -- Public URLs with built-in rate limiting.
- **Isolated Execution** -- Each run in a sandboxed container (`--network none`, read-only root, dropped capabilities).
- **CLI + MCP Server** -- Manage projects from the terminal or through AI agents.

## Persistent Storage SDK

User code can persist data across runs:

```python
from runit import storage

storage.set("config", {"theme": "dark"})
data = storage.get("config")        # {"theme": "dark"}
storage.get("missing", default=0)   # 0
storage.list()                       # ["config"]
storage.exists("config")            # True
storage.delete("config")            # True
```

- Persists across container restarts (mounted volume)
- 10MB per value, 100MB per project
- Atomic writes (no partial reads on concurrent access)
- Also accessible via HTTP API, CLI (`runit storage list`), and MCP tools

## Architecture

```
runtime-ai/
+-- docker-compose.yml          # Self-hosted deployment
+-- packages/
|   +-- cli/                    # CLI: runit deploy, runit storage, ...
|   +-- client/                 # TypeScript API client
|   +-- mcp-server/             # MCP tools for AI agents
|   +-- shared/                 # Shared types
+-- services/
|   +-- control-plane/          # Hono.js API server (projects, runs, storage, secrets)
|   +-- runner/                 # Python execution runtime (Docker image)
+-- docs/
    +-- protocol-openapi.yaml   # OpenAPI 3.0 spec
```

### How It Works

```
                    +-------------------+
                    |  Control Plane    |
  curl/CLI/MCP --> |  (Hono.js API)    |--> SQLite (metadata)
                    |                   |--> Filesystem (storage, code bundles)
                    +--------+----------+
                             |
                    docker run --network none
                             |
                    +--------v----------+
                    |   Runner          |
                    |   (Python 3.11)   |--> /storage (mounted volume)
                    |   User code runs  |
                    +-------------------+
```

1. **Upload** -- User uploads ZIP or raw Python code
2. **Parse** -- Control plane extracts endpoints from code/runit.yaml
3. **Store** -- Code bundle + metadata saved to SQLite + filesystem
4. **Execute** -- Each run launches an isolated Docker container
5. **Persist** -- Storage SDK reads/writes to mounted volume

## API Reference

All endpoints are under `/v1/`. Full OpenAPI spec at `/v1/openapi.json`.

### Projects

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/projects` | GET | List all projects |
| `/v1/projects` | POST | Create project from ZIP |
| `/v1/projects/:id` | GET | Get project details |
| `/v1/projects/:id` | DELETE | Delete project (+ storage cleanup) |
| `/v1/deploy` | POST | One-call deploy (code + name) |

### Versions

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/projects/:id/versions` | GET | List versions |
| `/v1/projects/:id/versions/:vid/promote` | POST | Promote to dev/prod |
| `/v1/projects/:id/deploy` | POST | Deploy a version |

### Runs

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/runs` | POST | Execute an endpoint |
| `/v1/runs/:id` | GET | Get run status/result |

### Secrets

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/projects/:id/secrets` | POST | Create secret |
| `/v1/projects/:id/secrets` | GET | List secrets (keys only) |
| `/v1/projects/:id/secrets/:key` | PUT | Update secret |
| `/v1/projects/:id/secrets/:key` | DELETE | Delete secret |

### Storage

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/projects/:id/storage` | GET | List keys + usage |
| `/v1/projects/:id/storage/:key` | PUT | Store value (JSON body: `{"value": ...}`) |
| `/v1/projects/:id/storage/:key` | GET | Get value |
| `/v1/projects/:id/storage/:key` | DELETE | Delete value |

## CLI

```bash
npm install -g @runtime-ai/cli

runit deploy my-api.zip --name "My API"
runit projects list
runit storage list <project-id>
runit storage set <project-id> config '{"key": "value"}'
runit storage get <project-id> config
```

## MCP Server

For AI agents (Claude, etc.):

```bash
npm install -g @runtime-ai/mcp-server
```

Available tools: `deploy`, `list_projects`, `run_endpoint`, `storage_set`, `storage_get`, `storage_delete`, `storage_list`, and more.

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MASTER_ENCRYPTION_KEY` | Yes | -- | 32-byte base64 key for secrets encryption |
| `COMPUTE_BACKEND` | No | `docker` | `docker` for self-hosted, `modal` for cloud |
| `PORT` | No | `3001` | Server port |
| `API_KEY` | No | -- | Bearer token to protect API endpoints |
| `RUNNER_IMAGE` | No | `runtime-runner:latest` | Docker image for code execution |
| `RUNNER_MEMORY` | No | `512m` | Memory limit per container |
| `RUNNER_CPUS` | No | `1` | CPU limit per container |
| `RUNNER_NETWORK` | No | `none` | Network mode (`none` for isolation) |
| `TUNNEL_URL` | No | -- | Public URL (shown in API responses) |

See `.env.example` for the full list including cloud mode variables.

## FAQ

<details>
<summary><strong>What Python frameworks are supported?</strong></summary>

FastAPI apps are auto-detected. Plain functions with type hints (`def calc(x: int) -> dict`) are auto-wrapped as POST endpoints. Use a `runit.yaml` to define custom endpoints.
</details>

<details>
<summary><strong>Do I need Supabase or Modal?</strong></summary>

No. Self-hosted mode uses SQLite + Docker. Supabase and Modal are optional for cloud deployments.
</details>

<details>
<summary><strong>How are secrets stored?</strong></summary>

Secrets are encrypted with AES-256-GCM using the `MASTER_ENCRYPTION_KEY`. Plaintext never touches the database.
</details>

<details>
<summary><strong>Is user code isolated?</strong></summary>

Yes. Each run executes in a Docker container with `--network none`, `--read-only`, `--cap-drop ALL`, and `--security-opt no-new-privileges`. User code cannot access the network, modify the filesystem (except /storage and /tmp), or escalate privileges.
</details>

<details>
<summary><strong>How does persistent storage work?</strong></summary>

Each project gets a directory on a Docker volume, mounted at `/storage` inside runner containers. The Python SDK (`from runit import storage`) reads/writes files there with atomic writes (temp file + rename). The same data is also accessible via the HTTP API.
</details>

## Development

```bash
npm install
npm run build   # Build all workspaces
npm test        # Run all tests (515 TypeScript + 130 Python)
npm run lint    # Lint
```

## Examples

See the [`examples/`](examples/) directory for sample projects:

- **invoice-generator** -- FastAPI app that generates invoices
- **text-analyzer** -- Text analysis with NLP
- **unit-converter** -- Simple unit conversion API

Each example can be deployed with `runit deploy`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT License -- see [LICENSE](LICENSE) for details.
