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
- `services/control-plane/` - Hono.js API server, SQLite/Supabase, deployment orchestration
  - Exports `createApp()` factory for cloud-plane to extend
- `services/runner/` - Python executor, runit SDK (`@app.action`, `remember()`), Docker sandbox
- `packages/cli/` - CLI tool (`runit deploy`, `runit run`, etc.)
- `packages/client/` - JavaScript/TypeScript client SDK
- `packages/mcp-server/` - MCP server for AI agent integration
- `packages/openapi-form/` - Auto-generates web forms from OpenAPI schemas
- `packages/shared/` - TypeScript types and contracts
- `packages/ui/` - Shared React components
- `apps/web/` - Next.js web app (landing, paste code, run, share pages)

## Two-Repo Strategy
- **OSS repo** (`buildingopen/runit`, public): Self-hosted, SQLite, Docker sandbox, API-key auth
- **Cloud repo** (`federicodeponte/runit-cloud`, private): Imports @runit/control-plane, adds Supabase auth, Stripe billing, quotas

## Key Commands
- Build all: `npm run build`
- Build control plane: `npx turbo run build --filter=@runit/control-plane`
- Test control plane: `npm test --workspace=services/control-plane`
- Control plane dev: `cd services/control-plane && npm run dev`
- Web app: `cd apps/web && npm run dev`
- CLI: `node packages/cli/dist/index.js`
- Docker: `docker-compose up --build`

## Style
- Never use em dashes
- User-facing text: friendly, no jargon
- Code: TypeScript (control plane, packages), Python (runner)
