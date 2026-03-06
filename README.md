<div align="center">

# RunIt

### AI writes code. RunIt makes it real.

Paste any Python function. Get a live web app with a shareable link.

[Try It](https://runit.dev) · [Examples](#examples) · [For Developers](#for-developers)

</div>

---

## How It Works

1. **Get code from AI.** Ask ChatGPT, Claude, or Cursor for a Python function.
2. **Paste it on [runit.dev](https://runit.dev).** Hit "Go Live."
3. **Share the link.** Anyone can use your app immediately.

Your function gets a web interface automatically. No accounts, no setup, no servers.

## What You Get

- **A live web app.** Your function becomes a form anyone can fill out and run.
- **A shareable link.** Send it to anyone. They see a clean UI, not code.
- **Built-in memory.** Your app can remember data between uses.
- **No setup.** No servers, no databases, no hosting, no command line.

## Try It

Go to [runit.dev](https://runit.dev) and paste this:

```python
def greet(name):
    return {"message": f"Hello, {name}!"}
```

That's it. You now have a live web app with a form and a shareable link.

### Your App Can Remember Things

```python
from runit import remember

def count_visits(name):
    visits = remember("visits") or 0
    visits = visits + 1
    remember("visits", visits)
    return {"message": f"Hello {name}! Visit #{visits}"}
```

Every time someone runs this, the counter goes up. Your app remembers data between uses, no database required.

## Examples

| Example | What it does |
|---------|-------------|
| [Invoice Generator](examples/invoice-generator) | Create invoices with automatic tax calculation |
| [Text Analyzer](examples/text-analyzer) | Count words, find common phrases, detect sentiment |
| [Unit Converter](examples/unit-converter) | Convert temperatures and distances between units |

---

## For Developers

<details>
<summary><strong>CLI</strong></summary>

```bash
npm install -g @runit/cli

# Deploy a Python file
runit deploy my-app.py --name "My App"

# List your apps
runit projects list

# Run an action
runit run <project-id> greet --name "World"
```

</details>

<details>
<summary><strong>Storage SDK</strong></summary>

The full storage API for developers:

```python
from runit import storage

storage.set("config", {"theme": "dark"})
data = storage.get("config")        # {"theme": "dark"}
storage.get("missing", default=0)   # 0
storage.list()                       # ["config"]
storage.delete("config")
```

- Persists across runs (mounted volume)
- 10MB per value, 100MB per project
- Atomic writes
- Also accessible via HTTP API, CLI (`runit storage list`), and MCP tools

</details>

<details>
<summary><strong>Self-Hosting</strong></summary>

Requires Docker with Docker Compose.

```bash
git clone https://github.com/federicodeponte/runtime-ai.git
cd runtime-ai

# Generate encryption key
export MASTER_ENCRYPTION_KEY=$(openssl rand -base64 32)

# Build and start
docker-compose up --build -d

# Verify
curl http://localhost:3001/health
```

#### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MASTER_ENCRYPTION_KEY` | Yes | | 32-byte base64 key for secrets encryption |
| `COMPUTE_BACKEND` | No | `docker` | `docker` for self-hosted, `modal` for cloud |
| `PORT` | No | `3001` | Server port |
| `API_KEY` | No | | Bearer token to protect API |
| `RUNNER_IMAGE` | No | `runtime-runner:latest` | Docker image for code execution |
| `RUNNER_MEMORY` | No | `512m` | Memory limit per container |
| `RUNNER_CPUS` | No | `1` | CPU limit per container |
| `RUNNER_NETWORK` | No | `none` | Network mode (`none` for isolation) |

See `.env.example` for the full list.

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

**Apps:** `GET /v1/projects`, `POST /v1/projects`, `GET /v1/projects/:id`, `DELETE /v1/projects/:id`, `POST /v1/deploy`

**Versions:** `GET /v1/projects/:id/versions`, `POST /v1/projects/:id/versions/:vid/promote`, `POST /v1/projects/:id/deploy`

**Runs:** `POST /v1/runs`, `GET /v1/runs/:id`

**API Keys:** `POST /v1/projects/:id/secrets`, `GET /v1/projects/:id/secrets`, `PUT /v1/projects/:id/secrets/:key`, `DELETE /v1/projects/:id/secrets/:key`

**Storage:** `GET /v1/projects/:id/storage`, `PUT /v1/projects/:id/storage/:key`, `GET /v1/projects/:id/storage/:key`, `DELETE /v1/projects/:id/storage/:key`

</details>

<details>
<summary><strong>Architecture</strong></summary>

```
runit/
+-- apps/web/                  # Next.js web app (paste, deploy, run, share)
+-- packages/
|   +-- cli/                   # CLI: runit deploy, runit run, ...
|   +-- client/                # TypeScript API client
|   +-- mcp-server/            # MCP tools for AI agents
|   +-- openapi-form/          # Auto-generates web forms from functions
+-- services/
|   +-- control-plane/         # Hono.js API server
|   +-- runner/                # Python execution runtime
```

</details>

<details>
<summary><strong>Development</strong></summary>

```bash
npm install
npm run build   # Build all packages
npm test        # Run all tests
npm run lint
```

</details>

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT. See [LICENSE](LICENSE).
