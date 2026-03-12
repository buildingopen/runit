# Integrations and Standards

RunIt is designed to work with common API and automation tooling without custom adapters.

## OpenAPI-first

- OpenAPI schema: `GET /v1/openapi.json`
- API docs landing: `GET /docs`
- Health check: `GET /health`

Use this schema directly in:

- Postman import
- Insomnia design/import
- client generation tools
- API testing pipelines

## Browser automation

RunIt web pages are standard web routes and can be tested with browser automation tools.

Typical routes:

- Dashboard: `/dashboard`
- New app flow: `/new`
- App page: `/p/:projectId`
- Share page: `/s/:shareId`

Existing golden path is verified with Playwright in `tests/e2e/golden-path.spec.ts`.

## CLI + API pairing

Use CLI for app lifecycle and API for advanced automation:

```bash
# CLI setup verification
runit doctor

# API contract
curl http://localhost:3001/v1/openapi.json
```

## cURL examples

```bash
# Health
curl http://localhost:3001/health

# List apps
curl -H "Authorization: Bearer $RUNIT_API_KEY" \
  http://localhost:3001/v1/projects
```

## Why this matters

You can start in the UI, switch to CLI, and then automate with API tooling using the same underlying contracts.
