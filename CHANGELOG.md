# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-02-06

### Added

- **ZIP Upload** — Upload FastAPI projects as ZIP files for instant deployment
- **OpenAPI Detection** — Automatic form generation from OpenAPI/Swagger schemas
- **Secrets Management** — Encrypted storage for API keys and sensitive configuration
- **Artifact Storage** — Persist files generated during execution with download links
- **Share Links** — Public URLs for sharing API endpoints
- **Context System** — Mount external data sources to execution environments
- **Modal Integration** — Serverless execution on Modal infrastructure
- **Run History** — Track execution history with logs and outputs
- **Cost Monitoring** — Basic usage tracking and cost estimation

### Infrastructure

- Next.js 14 web application
- Hono API backend (control-plane)
- Modal-based Python runner
- Supabase for database and auth
- Turborepo monorepo structure
