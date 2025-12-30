# Execution Layer v0

**"Colab for Apps"** - Run FastAPI apps in ephemeral sandboxes, auto-generate Run Pages from OpenAPI, share safely.

## Project Status

✅ **Repository scaffolded**
⏳ **Implementation in progress** (10 agents working in parallel)

## What This Is

- Upload/import a FastAPI project
- Run it in an ephemeral sandbox (Modal)
- Auto-generate Run Pages from OpenAPI
- Share endpoints safely (no secret leakage)

## What This Is NOT

- ❌ Not a PaaS (no always-on hosting)
- ❌ Not production infrastructure (yet)
- ❌ Not a deployment platform

Built for **fast iteration** and **viral sharing** of FastAPI apps.

## Repository Structure

```
execution-layer/
  apps/web/                     # Next.js UI (Run Pages, sharing)
  services/
    control-plane/              # API: projects, runs, secrets, sharing
    runner/                     # Modal execution kernel
  packages/
    shared/                     # Shared types + contracts
    ui/                         # UI primitives
    openapi-form/               # Schema → form generation
    sdk/                        # Optional Python helpers
  infra/                        # Infrastructure as code
  docs/                         # Documentation
```

## Development

**Prerequisites:**
- Node.js >= 18
- Python >= 3.11
- Modal account (for runner)
- Supabase account (for database)

**Setup:**
```bash
# Install dependencies
npm install

# Set up Python environments
cd services/runner && python -m venv venv && source venv/bin/activate
pip install -e ".[dev]"
```

**Run locally:**
```bash
# Web UI
cd apps/web && npm run dev

# Control plane API
cd services/control-plane && npm run dev

# Modal runner (local testing)
cd services/runner && modal serve src/modal_app.py
```

## Architecture

- **Frontend**: Next.js 15 + React 19 + TypeScript 5 + Tailwind CSS 4
- **Backend**: Hono (control-plane) + Modal (runner)
- **Database**: Supabase PostgreSQL
- **Storage**: S3-compatible (artifacts)
- **Secrets**: KMS encryption

## Documentation

See [CLAUDE.md](./CLAUDE.md) for complete technical specification (3,800+ lines).

See [DECISIONS.md](./DECISIONS.md) for all locked architectural decisions.

See [IMPLEMENTATION_READY.md](./IMPLEMENTATION_READY.md) for implementation guide.

## Contributing

This project uses a 10-agent development model with git worktrees. See agent briefings in project root.

## License

[TBD]

---

**Built for vibe coders who ship.**
