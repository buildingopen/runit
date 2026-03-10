<div align="center">

# RunIt

### AI writes code. RunIt makes it real.

Auto-generated UI from type hints. Shareable link. Built-in storage. Self-hosted with Docker.

![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)

</div>

---

## Quick Start

```bash
docker run -p 3000:3000 ghcr.io/buildingopen/runit
```

Open [localhost:3000](http://localhost:3000). Paste this:

```python
from runit import app

@app.action
def greet(name: str) -> dict:
    return {"message": f"Hello, {name}!"}
```

Hit "Go Live." Share the link. That's it.

## How It Works

1. You write a Python function with type hints
2. RunIt extracts the schema (OpenAPI)
3. RunIt generates a web form from the schema
4. RunIt runs the function in a Docker sandbox
5. Anyone with the link can use it

## Your App Can Remember Things

```python
from runit import app, remember

@app.action
def count_visits(name: str) -> dict:
    visits = (remember("visits") or 0) + 1
    remember("visits", visits)
    return {"message": f"Hello {name}! Visit #{visits}"}
```

No database setup. Built-in key-value storage.

## Examples

| Example | What it does |
|---------|-------------|
| [Invoice Generator](examples/invoice-generator) | Create invoices with automatic tax calculation |
| [Text Analyzer](examples/text-analyzer) | Count words, find common phrases, detect sentiment |
| [Unit Converter](examples/unit-converter) | Convert temperatures and distances between units |

---

## Self-Hosting

```bash
git clone https://github.com/buildingopen/runit
cd runit
docker-compose up --build
```

That's it. SQLite database, Docker sandbox, zero cloud dependencies.

<details>
<summary><strong>Environment Variables</strong></summary>

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MASTER_ENCRYPTION_KEY` | Yes | | 32-byte base64 key for secrets encryption |
| `COMPUTE_BACKEND` | No | `docker` | `docker` for self-hosted |
| `PORT` | No | `3001` | Server port |
| `API_KEY` | No | | Bearer token to protect API |
| `RUNNER_IMAGE` | No | `runit-runner:latest` | Docker image for code execution |
| `RUNNER_MEMORY` | No | `512m` | Memory limit per container |
| `RUNNER_CPUS` | No | `1` | CPU limit per container |
| `RUNNER_NETWORK` | No | `none` | Network mode (`none` for isolation) |

See `.env.example` for the full list.

</details>

---

## For Developers

<details>
<summary><strong>Python SDK</strong></summary>

```python
from runit import app, remember, forget, storage

# Mark functions as actions
@app.action
def my_func(x: int) -> dict:
    return {"result": x * 2}

# Custom action name
@app.action(name="custom_name")
def another_func(y: str) -> dict:
    return {"greeting": f"Hello, {y}!"}

# Full storage API
storage.set("config", {"theme": "dark"})
data = storage.get("config")        # {"theme": "dark"}
storage.get("missing", default=0)   # 0
storage.list()                       # ["config"]
storage.delete("config")
```

</details>

<details>
<summary><strong>CLI</strong></summary>

```bash
npm install -g @runit/cli

# Deploy a Python file
runit deploy my-app.py --name "My App"

# List your apps
runit list

# View logs
runit logs

# Manage storage
runit storage list
runit storage get <key>
runit storage set <key> <value>

# Share your app
runit share create <endpoint_id>
```

</details>

<details>
<summary><strong>MCP Server (for AI agents)</strong></summary>

```bash
npm install -g @runit/mcp-server
```

Gives AI agents (Claude, Cursor, etc.) tools to deploy code, run actions, and manage storage.

</details>

<details>
<summary><strong>API Reference</strong></summary>

All routes are under `/v1/`. Full OpenAPI spec at `/v1/openapi.json`.

**Apps:** `GET /v1/projects`, `POST /v1/projects`, `GET /v1/projects/:id`, `DELETE /v1/projects/:id`

**Deploy:** `POST /v1/projects/:id/deploy`, `GET /v1/projects/:id/deploy/status`

**Runs:** `POST /v1/runs`, `GET /v1/runs/:id`

**Secrets:** `POST /v1/projects/:id/secrets`, `GET /v1/projects/:id/secrets`

**Storage:** `GET /v1/projects/:id/storage`, `PUT /v1/projects/:id/storage/:key`, `GET /v1/projects/:id/storage/:key`

</details>

<details>
<summary><strong>Architecture</strong></summary>

```
Function (type hints) -> OpenAPI Schema -> Auto-generated Form -> Shareable Link
                              |
                         Docker Sandbox
                              |
                           SQLite
```

```
runit/
+-- apps/web/                  # Next.js web app (paste, deploy, run, share)
+-- packages/
|   +-- cli/                   # CLI: runit deploy, runit run, ...
|   +-- client/                # TypeScript API client
|   +-- mcp-server/            # MCP tools for AI agents
|   +-- openapi-form/          # Auto-generates web forms from functions
|   +-- shared/                # TypeScript types and contracts
|   +-- ui/                    # Shared React components
+-- services/
|   +-- control-plane/         # Hono.js API server
|   +-- runner/                # Python execution runtime + SDK
```

</details>

<details>
<summary><strong>Development</strong></summary>

```bash
npm install
npm run build   # Build all packages
npm test        # Run all tests
```

</details>

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT. See [LICENSE](LICENSE).
</div>
