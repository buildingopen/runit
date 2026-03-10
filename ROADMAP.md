# RunIt Roadmap

## Current Status

RunIt is functional and self-hostable via Docker. The core flow works: paste Python code, get a live web app with auto-generated UI, share the link.

## What Works Today

- Control Plane API (Hono.js, SQLite, Docker compute backend)
- Python Runner (Docker sandbox, dependency installation, schema extraction)
- Web UI (Next.js, paste code, deploy, run, share)
- CLI (`runit deploy`, `runit list`, `runit storage`, etc.)
- Python SDK (`@app.action`, `remember()`, `storage`)
- MCP Server (AI agent integration)
- Secret management (encrypted at rest)
- Share links (public URLs for apps)

## Planned

### Developer Experience
- [ ] `pip install runit` (publish SDK to PyPI)
- [ ] `runit serve` CLI command (local dev with hot reload)
- [ ] Pre-built Docker image on GHCR
- [ ] One-click deploy buttons (Railway, Render, Fly.io)

### Platform
- [ ] GPU support for ML workloads
- [ ] Scheduled runs (cron)
- [ ] Webhook triggers
- [ ] Custom domains for shared apps
- [ ] Multi-file project support (directories, not just single files)

### SDK
- [ ] `@app.action` with input validation decorators
- [ ] File upload/download support in actions
- [ ] Streaming responses
- [ ] Background tasks

### Integrations
- [ ] GitHub Actions for CI/CD deploy
- [ ] VS Code extension
- [ ] Slack notifications on run completion
