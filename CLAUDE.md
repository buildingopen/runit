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

## Key Commands
- Build all: `npm run build`
- Control plane: `cd services/control-plane && npm run dev`
- Web app: `cd apps/web && npm run dev`
- CLI: `node packages/cli/dist/index.js`

## Style
- Never use em dashes
- User-facing text: friendly, no jargon
- Code: TypeScript (control plane, packages), Python (runner)
