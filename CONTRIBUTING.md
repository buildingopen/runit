# Contributing to Runtime AI

Thank you for your interest in contributing to Runtime AI! This document provides guidelines and information for contributors.

## Getting Started

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/runtime-ai.git
   cd runtime-ai
   ```
3. Add the upstream remote:
   ```bash
   git remote add upstream https://github.com/your-org/runtime-ai.git
   ```

### Development Setup

See [docs/DEVELOPMENT_SETUP.md](docs/DEVELOPMENT_SETUP.md) for detailed environment setup instructions.

Quick start:
```bash
npm install
cd services/runner && python3.11 -m venv venv && source venv/bin/activate && pip install -e ".[dev]"
```

## Development Workflow

### Branch Naming

Use descriptive branch names with a prefix:
- `feat/` — New features
- `fix/` — Bug fixes
- `docs/` — Documentation changes
- `refactor/` — Code refactoring
- `test/` — Test additions or fixes

Example: `feat/add-github-context-source`

### Commits

Write clear, concise commit messages:
- Use present tense ("Add feature" not "Added feature")
- Use imperative mood ("Move cursor to..." not "Moves cursor to...")
- Keep the first line under 72 characters
- Reference issues when applicable

Example:
```
Add GitHub repository context source

Implements fetching files from GitHub repos as context mounts.
Supports public repos and private repos with token auth.

Closes #42
```

### Running Tests

```bash
# All tests
npm run test

# Specific package
cd packages/openapi-form && npm test

# Python tests
cd services/runner && pytest
```

### Linting

```bash
# Check all
npm run lint

# Auto-fix
npm run format
```

## Pull Request Process

1. **Create a branch** from `main` for your changes
2. **Make your changes** with appropriate tests
3. **Run tests and linting** to ensure everything passes
4. **Push your branch** to your fork
5. **Open a Pull Request** against `main`

### PR Requirements

- Fill out the PR template completely
- All CI checks must pass
- Include tests for new functionality
- Update documentation if needed
- Keep PRs focused—one feature or fix per PR

### Review Process

- A maintainer will review your PR
- Address any requested changes
- Once approved, a maintainer will merge

## Code Style

### TypeScript / JavaScript

- Prettier for formatting
- ESLint for linting
- Use TypeScript strict mode
- Prefer `const` over `let`
- Use meaningful variable names

### Python

- Black for formatting
- Ruff for linting
- Type hints for function signatures
- Docstrings for public functions

## Architecture Guidelines

### Package Boundaries

- `packages/shared` — Types and contracts used across packages
- `packages/ui` — React components (no business logic)
- `packages/openapi-form` — OpenAPI parsing and form generation
- `services/control-plane` — API endpoints and business logic
- `services/runner` — Isolated execution environment
- `apps/web` — Next.js frontend (composition layer)

### Key Principles

- Keep the runner minimal and secure
- All user code runs in Modal containers
- Secrets never leave the control plane unencrypted
- API responses follow consistent patterns

## Getting Help

- Open an issue for bugs or feature requests
- Start a discussion for questions or ideas
- Check existing issues before creating new ones

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
