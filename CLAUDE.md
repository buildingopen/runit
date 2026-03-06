# RunIt

## Positioning
"AI writes code. RunIt makes it real."
Target audience: people who get Python code from AI (ChatGPT, Cursor, Claude) but can't deploy it.
Secondary: developers wanting zero-config deployment.

## Terminology (User-Facing)
| Use This | Not This | Context |
|----------|----------|---------|
| Action | Endpoint | Web UI, CLI output, docs |
| API Keys | Secrets | Config page, CLI help |
| Memory | Storage | Non-dev docs, README |
| Go Live | Deploy | Web UI buttons |
| remember() | storage.get/set | Non-dev code examples |
| App | Project | User-facing references |

Developer docs can use technical terms. User-facing text uses the friendly terms.

## Architecture
Monorepo with:
- `services/control-plane/` - Hono.js API server, SQLite, deployment orchestration
- `services/runner/` - Python executor, runit SDK, storage, Modal/Docker backends
- `packages/cli/` - CLI tool (`runit deploy`, `runit run`, etc.)
- `packages/client/` - JavaScript/TypeScript client SDK
- `packages/mcp-server/` - MCP server for AI agent integration
- `packages/openapi-form/` - Auto-generates web forms from OpenAPI schemas
- `apps/web/` - Next.js web app (landing, upload, run, share pages)

## Deployment (AX41, free-only)
- **Compute backend**: Docker on AX41 (not Modal). Set `COMPUTE_BACKEND=docker`.
- **Stripe/billing**: Optional. Env vars (`STRIPE_*`, `FRONTEND_URL`) are `required: 'optional'` in `env.ts`. Billing routes return 503 when no Stripe keys. Everyone defaults to `free` tier.
- **Runner image**: `docker build -t runtime-runner:latest services/runner/`
- **Control plane image**: Built via `infra/deploy.sh` or `docker-compose -f infra/docker-compose.yml up -d`
- **Infra files**: `infra/docker-compose.yml` (docker.sock mounted), `infra/Caddyfile` (reverse proxy), `infra/.env.example` (template), `infra/deploy.sh`
- **Dockerfile** includes `docker-cli` so control-plane container can spawn runner containers via the mounted socket.
- **Supabase**: Free tier for auth + data. Federico sets up separately, provides URL + keys.
- **Status (Mar 2026)**: Code changes done, build passes, 404 tests pass, runner image built. Waiting on Supabase project creation before deploying.

## Key Commands
- Build all: `npm run build`
- Build control plane: `npx turbo run build --filter=@runtime-ai/control-plane`
- Test control plane: `npm test --workspace=services/control-plane`
- Control plane dev: `cd services/control-plane && npm run dev`
- Web app: `cd apps/web && npm run dev`
- CLI: `node packages/cli/dist/index.js`
- Deploy to AX41: `./infra/deploy.sh` (from repo root)

## Style
- Never use em dashes
- User-facing text: friendly, no jargon
- Code: TypeScript (control plane, packages), Python (runner)
