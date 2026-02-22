# Testing Guide - Runtime v0

**Status:** Infrastructure Ready ✅
**Last Updated:** 2024-12-30

## Overview

This guide covers testing strategies, infrastructure, and commands for all 10 agents working on Runtime.

> Current authoritative CI gates and thresholds are in `docs/QUALITY_GATES.md`.

---

## Testing Philosophy

**Priority:** E2E tests first → Integration → Unit tests

**Why:**
- E2E tests verify the product works (most important)
- Integration tests verify services work together
- Unit tests verify individual components

**Golden Rule:** If the golden path E2E test passes, the product works.

---

## Testing Frameworks

### TypeScript/JavaScript (Web, Control Plane, Packages)
- **Vitest** - Unit & integration tests
- **Playwright** - E2E tests
- **Testing Library** - React component tests

### Python (Runner, SDK)
- **pytest** - Unit & integration tests
- **pytest-asyncio** - Async test support
- **pytest-cov** - Coverage reporting

---

## Test Ownership by Agent

| Agent | Tests | Location | Framework |
|-------|-------|----------|-----------|
| **Agent 1 (ARCHITECT)** | Contract validation | `packages/shared/src/__tests__/` | Vitest |
| **Agent 2 (KERNEL)** | Runtime integration | `services/runner/tests/integration/` | pytest |
| **Agent 3 (BRIDGE)** | OpenAPI extraction | `services/runner/tests/unit/` | pytest |
| **Agent 4 (AESTHETIC)** | Component tests | `packages/ui/src/__tests__/` | Vitest + Testing Library |
| **Agent 5 (RUNPAGE)** | Form generation + E2E | `packages/openapi-form/src/__tests__/`, `tests/e2e/` | Vitest + Playwright |
| **Agent 6 (MEMORY)** | Context API | `services/control-plane/src/__tests__/` | Vitest |
| **Agent 7 (TRUST)** | Secrets encryption | `services/control-plane/src/__tests__/` | Vitest |
| **Agent 8 (DELIGHT)** | Sample apps | `services/runner/samples/*/test_*.py` | pytest |
| **Agent 9 (FINOPS)** | Middleware | `services/control-plane/src/middleware/__tests__/` | Vitest |
| **Agent 10 (CUTTER)** | None (reviews only) | N/A | N/A |

---

## Coverage Requirements

| Agent | Minimum Coverage | Why |
|-------|------------------|-----|
| Agent 1 | 100% | Contracts are foundation |
| Agent 2 | 90% | Runtime is critical |
| Agent 3 | 95% | OpenAPI parsing must be reliable |
| Agent 4 | 80% | UI components need visual QA too |
| Agent 5 | 90% | Form generation is complex |
| Agent 6 | 85% | Context system is important |
| Agent 7 | 95% | Secrets are security-critical |
| Agent 8 | 90% | SDK must be reliable |
| Agent 9 | 90% | Rate limiting is critical |

---

## Running Tests

### All Tests (Root Level)

```bash
# Run all tests across all workspaces
npm run test

# Run with coverage
npm run test:coverage
```

### TypeScript Packages

```bash
# Shared contracts/types
cd packages/shared
npm run test
npm run test:watch
npm run test:coverage

# UI components
cd packages/ui
npm run test

# OpenAPI form generation
cd packages/openapi-form
npm run test
```

### Control Plane (TypeScript)

```bash
cd services/control-plane
npm run test
npm run test:watch
npm run test:coverage
```

### Runner (Python)

```bash
cd services/runner

# All tests
pytest

# Specific test file
pytest tests/unit/test_openapi.py

# With coverage
pytest --cov=src --cov-report=html

# Verbose output
pytest -v

# Watch mode (requires pytest-watch)
ptw

# Skip slow tests
pytest -m "not slow"

# Skip Modal tests (if no credentials)
pytest -m "not requires_modal"
```

### E2E Tests (Playwright)

```bash
cd apps/web

# Run all E2E tests
npm run test:e2e

# Run in UI mode (interactive)
npm run test:e2e:ui

# Run specific test
npx playwright test tests/e2e/golden-path.spec.ts

# Debug mode
npx playwright test --debug

# Generate code
npx playwright codegen http://localhost:3000
```

---

## Test Structure Examples

### TypeScript Unit Test (Vitest)

```typescript
// packages/shared/src/__tests__/contracts.test.ts

import { describe, it, expect } from 'vitest';
import { RunEndpointRequest, RunEndpointResponse } from '../contracts';

describe('RunEndpointRequest', () => {
  it('should validate valid request', () => {
    const request: RunEndpointRequest = {
      run_id: 'abc-123',
      build_id: 'build-456',
      endpoint_id: 'POST /extract',
      request_data: {},
      secrets_ref: 'secrets-ref',
      context_ref: 'context-ref',
      lane: 'cpu',
      timeout_seconds: 60,
      max_memory_mb: 4096,
    };

    expect(request.lane).toBe('cpu');
    expect(request.timeout_seconds).toBe(60);
  });

  it('should reject invalid lane', () => {
    // Test validation logic
    expect(() => {
      const request = { lane: 'invalid' };
      // Zod schema validation would throw here
    }).toThrow();
  });
});
```

### React Component Test (Testing Library)

```typescript
// packages/ui/src/__tests__/Button.test.tsx

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '../Button';

describe('Button', () => {
  it('renders with correct text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);

    fireEvent.click(screen.getByText('Click me'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('applies variant styles correctly', () => {
    render(<Button variant="primary">Primary</Button>);
    const button = screen.getByText('Primary');
    expect(button).toHaveClass('bg-primary');
  });
});
```

### Python Unit Test (pytest)

```python
# services/runner/tests/unit/test_openapi.py

import pytest
from src.openapi.extractor import extract_openapi


def test_extract_openapi_from_fastapi_app(sample_fastapi_code):
    """Test OpenAPI extraction from FastAPI app."""
    # TODO: Agent 3 (BRIDGE) will implement
    pass


def test_entrypoint_detection(temp_project_dir):
    """Test entrypoint auto-detection."""
    from src.openapi.detect import detect_entrypoint

    # Should detect main:app
    entrypoint = detect_entrypoint(temp_project_dir)
    assert entrypoint == "main:app"


@pytest.mark.asyncio
async def test_in_process_execution():
    """Test in-process endpoint execution via httpx.AsyncClient."""
    # TODO: Agent 2 (KERNEL) will implement
    pass


@pytest.mark.slow
def test_dependency_installation():
    """Test dependency installation with caching."""
    # TODO: Agent 2 (KERNEL) will implement
    pass


@pytest.mark.requires_modal
def test_modal_function_execution():
    """Test Modal function execution (requires credentials)."""
    # TODO: Agent 2 (KERNEL) will implement
    # This test will be skipped if MODAL_TOKEN_ID not set
    pass
```

### E2E Test (Playwright)

```typescript
// tests/e2e/run-page.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Run Page', () => {
  test('should render form from OpenAPI schema', async ({ page }) => {
    // Navigate to endpoint Run Page
    await page.goto('/p/test-project/e/post-extract');

    // Should show endpoint title
    await expect(page.locator('h1')).toContainText('POST /extract');

    // Should show form fields from schema
    await expect(page.locator('input[name="url"]')).toBeVisible();
    await expect(page.locator('label:has-text("URL")')).toBeVisible();

    // Fill form
    await page.fill('input[name="url"]', 'https://example.com');

    // Click Run button
    await page.click('button:has-text("Run")');

    // Wait for result
    await expect(page.locator('.result-viewer')).toBeVisible({ timeout: 10000 });

    // Should show JSON result
    await expect(page.locator('.json-viewer')).toContainText('company');
  });

  test('should show artifacts download links', async ({ page }) => {
    await page.goto('/p/test-project/e/post-extract');

    // Run endpoint
    await page.fill('input[name="url"]', 'https://example.com');
    await page.click('button:has-text("Run")');

    // Wait for result
    await page.waitForSelector('.result-viewer');

    // Should show artifacts section
    await expect(page.locator('text=Artifacts')).toBeVisible();
    await expect(page.locator('a[download]')).toBeVisible();
  });
});
```

---

## CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml

name: Tests

on:
  push:
    branches: [main, agent-*]
  pull_request:
    branches: [main]

jobs:
  test-ts:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 18
      - run: npm install
      - run: npm run test

  test-python:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - run: pip install -e services/runner[dev]
      - run: pytest services/runner

  test-e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm install
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
```

---

## Test Data & Fixtures

### Sample Projects

**Location:** `services/runner/samples/`

**Available samples:**
- `extract-company/` - Golden demo (web scraping + artifacts)
- `hello-world/` - Minimal FastAPI app
- `file-upload/` - File upload handling

### Mock Data

**Location:** `tests/fixtures/`

Create shared fixtures:
```typescript
// tests/fixtures/mock-openapi.ts
export const mockOpenAPISpec = {
  openapi: '3.0.0',
  info: { title: 'Test API', version: '1.0.0' },
  paths: { /* ... */ },
};
```

---

## Debugging Tests

### Vitest Debugging

```bash
# Run with --inspect flag
node --inspect-brk ./node_modules/.bin/vitest run

# Use VS Code debugger
# Add to .vscode/launch.json:
{
  "type": "node",
  "request": "launch",
  "name": "Debug Vitest",
  "program": "${workspaceFolder}/node_modules/vitest/vitest.mjs",
  "args": ["run"],
  "console": "integratedTerminal"
}
```

### Playwright Debugging

```bash
# Debug mode (opens browser with dev tools)
npx playwright test --debug

# UI mode (interactive test runner)
npx playwright test --ui

# Headed mode (see browser)
npx playwright test --headed

# Trace viewer
npx playwright show-trace trace.zip
```

### pytest Debugging

```bash
# Drop into debugger on failure
pytest --pdb

# Drop into debugger at start
pytest --trace

# Verbose output
pytest -vv

# Show print statements
pytest -s
```

---

## Performance Testing

### Load Testing (Future)

```python
# tests/performance/test_runner_load.py

@pytest.mark.slow
def test_concurrent_runs():
    """Test 10 concurrent runs don't degrade performance."""
    # TODO: Agent 9 (FINOPS) will implement
    pass
```

---

## Best Practices

### DO:
✅ Test the happy path first
✅ Test error cases second
✅ Use fixtures for common setup
✅ Mock external services (API calls, Modal)
✅ Write descriptive test names
✅ Keep tests fast (<1s per unit test)
✅ Use appropriate markers (`@slow`, `@integration`, `@requires_modal`)

### DON'T:
❌ Test implementation details
❌ Write flaky tests
❌ Share state between tests
❌ Commit commented-out tests
❌ Skip tests without good reason

---

## Test Checklist for Agent PRs

Before merging any agent's branch:

- [ ] Tests added for new functionality
- [ ] All tests pass locally
- [ ] Coverage meets minimum requirements
- [ ] No flaky tests
- [ ] Test names are descriptive
- [ ] Fixtures used for common setup
- [ ] Mocks used for external services
- [ ] E2E tests updated if golden path changed

---

## Troubleshooting

### "Tests fail but code works locally"

**Likely causes:**
- Environment variables missing in test
- Async timing issues
- Race conditions
- Hard-coded paths

**Solutions:**
- Use fixtures for environment setup
- Add `await` for async operations
- Use `waitFor` in Playwright tests
- Use `tmp_path` fixture for temp directories

### "E2E tests are flaky"

**Likely causes:**
- Not waiting for elements
- Network timing
- Animation timing

**Solutions:**
```typescript
// Bad
await page.click('button');
expect(page.locator('.result')).toBeVisible();

// Good
await page.click('button');
await expect(page.locator('.result')).toBeVisible({ timeout: 10000 });
```

---

## Status: ✅ TESTING INFRASTRUCTURE READY

All testing tools configured and ready for agent use.

Next: Agents write tests as they implement features.
