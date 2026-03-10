# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-03-10

### Added

- **Python SDK** with `@app.action` decorator and `remember()` storage
- **ZIP Upload** for instant deployment of Python projects
- **Auto-generated UI** from Python type hints via OpenAPI schema extraction
- **Secrets Management** with encrypted storage for API keys
- **Share Links** for public URLs to share apps
- **Context System** for mounting external data to execution environments
- **Docker Sandbox** for isolated code execution
- **CLI** (`runit deploy`, `runit list`, `runit storage`, etc.)
- **MCP Server** for AI agent integration

### Infrastructure

- Next.js web application
- Hono API backend (control-plane) with SQLite
- Docker-based Python runner
- Turborepo monorepo structure
- Self-hostable via `docker-compose up --build`
