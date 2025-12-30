# Development Environment Setup

**Status:** Complete Guide ✅
**Last Updated:** 2024-12-30

## Prerequisites

### Required Software

| Tool | Version | Purpose |
|------|---------|---------|
| **Node.js** | >= 18.0.0 | TypeScript/JavaScript runtime |
| **npm** | >= 9.0.0 | Package manager |
| **Python** | >= 3.11 | Python runtime for Runner |
| **Git** | >= 2.30 | Version control |
| **Modal** | Latest | Execution platform (optional for local dev) |

### Optional Tools

| Tool | Purpose |
|------|---------|
| **VS Code** | Recommended IDE |
| **Docker** | Local database testing |
| **Postman/Insomnia** | API testing |

---

## Initial Setup (All Agents)

### 1. Clone Repository

```bash
cd ~/Downloads/runtime\ ai
cd execution-layer
```

**Verify structure:**
```bash
ls -la
# Should see: apps/, services/, packages/, infra/, docs/
```

### 2. Install Dependencies

**Root level (installs all workspaces):**
```bash
npm install
```

**Python Runner:**
```bash
cd services/runner
python3.11 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -e ".[dev]"
```

**Python SDK (optional):**
```bash
cd packages/sdk
python3.11 -m venv venv
source venv/bin/activate
pip install -e ".[dev]"
```

### 3. Environment Variables

**Create `.env.local` files:**

```bash
# apps/web/.env.local
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_ENABLE_MOCK_AUTH=true

# services/control-plane/.env.local
PORT=3001
DATABASE_URL=postgresql://user:pass@localhost:5432/execution_layer
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_KEY=your-service-key
AWS_S3_BUCKET=execution-layer-artifacts
AWS_KMS_KEY_ID=your-kms-key-id

# services/runner/.env.local
MODAL_TOKEN_ID=your-modal-token-id
MODAL_TOKEN_SECRET=your-modal-token-secret
```

**⚠️ CRITICAL:** Never commit `.env.local` files!

### 4. Verify Setup

```bash
# TypeScript compilation
npx tsc --noEmit

# Python syntax
cd services/runner && python -m py_compile src/modal_app.py

# Tests (should skip or pass)
npm run test
cd services/runner && pytest
```

---

## Agent-Specific Setup

### Agent 1 (ARCHITECT) - Control Plane + Contracts

**Worktree location:** `agent-1-architect/`

**Setup:**
```bash
cd agent-1-architect/services/control-plane
npm install
```

**Development:**
```bash
npm run dev  # Starts Hono server on port 3001
```

**Testing:**
```bash
npm run test
npm run test:watch
```

**Key files:**
- `services/control-plane/src/main.ts` - API entry point
- `services/control-plane/src/routes/` - API routes
- `packages/shared/src/contracts/` - API contracts

---

### Agent 2 (KERNEL) - Modal Runtime

**Worktree location:** `agent-2-kernel/`

**Setup:**
```bash
cd agent-2-kernel/services/runner
python3.11 -m venv venv
source venv/bin/activate
pip install -e ".[dev]"
```

**Modal setup:**
```bash
# Install Modal CLI
pip install modal

# Authenticate
modal token new

# Test connection
modal run src/modal_app.py
```

**Development:**
```bash
# Local Modal development server
modal serve src/modal_app.py

# Deploy to Modal
modal deploy src/modal_app.py
```

**Testing:**
```bash
pytest tests/
pytest tests/integration/ -m "not requires_modal"  # Skip Modal tests
```

**Key files:**
- `services/runner/src/modal_app.py` - Modal app definition
- `services/runner/src/build/` - Build & dependency logic
- `services/runner/src/execute/` - Execution logic

---

### Agent 3 (BRIDGE) - OpenAPI Extraction

**Worktree location:** `agent-3-bridge/`

**Setup:** Same as Agent 2 (shares Python environment)

**Development:**
```bash
cd agent-3-bridge/services/runner
source venv/bin/activate
pytest tests/unit/ -v
```

**Testing:**
```bash
# Test OpenAPI extraction
pytest tests/unit/test_openapi.py -v

# Test entrypoint detection
pytest tests/unit/test_detect.py -v
```

**Key files:**
- `services/runner/src/openapi/extractor.py`
- `services/runner/src/openapi/detect.py`
- `services/runner/src/errors/taxonomy.py`

---

### Agent 4 (AESTHETIC) - Design System

**Worktree location:** `agent-4-aesthetic/`

**Setup:**
```bash
cd agent-4-aesthetic/packages/ui
npm install
```

**Development:**
```bash
# Build package
npm run build

# Watch mode
npm run dev

# Test components
npm run test
```

**Storybook (optional):**
```bash
# If using Storybook for component development
npx storybook init
npm run storybook
```

**Key files:**
- `packages/ui/src/` - UI components
- `apps/web/styles/` - Global styles
- `apps/web/components/ui/` - shadcn/ui primitives

---

### Agent 5 (RUNPAGE) - Run Page & Forms

**Worktree location:** `agent-5-runpage/`

**Setup:**
```bash
cd agent-5-runpage/apps/web
npm install
```

**Development:**
```bash
# Start Next.js dev server
npm run dev
# Open http://localhost:3000
```

**E2E Testing:**
```bash
# Install Playwright browsers
npx playwright install

# Run E2E tests
npm run test:e2e

# Run in UI mode
npm run test:e2e:ui
```

**Key files:**
- `apps/web/app/p/[project]/e/[endpoint]/page.tsx` - Run Page
- `apps/web/components/run-page/` - Run Page components
- `packages/openapi-form/src/` - Form generation logic

---

### Agent 6 (MEMORY) - Context System

**Worktree location:** `agent-6-memory/`

**Setup:** Same as Agent 1 (shares control-plane)

**Development:**
```bash
cd agent-6-memory/services/control-plane
npm run dev
```

**Testing:**
```bash
# Test context fetch
npm run test -- context

# Manual API testing
curl -X POST http://localhost:3001/projects/test-id/context \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "name": "Test Company"}'
```

**Key files:**
- `services/control-plane/src/routes/context.ts`
- `services/control-plane/src/lib/context-fetcher.ts`

---

### Agent 7 (TRUST) - Secrets & Encryption

**Worktree location:** `agent-7-trust/`

**Setup:** Same as Agent 1 (shares control-plane)

**AWS KMS Setup (for local testing):**
```bash
# Install AWS CLI
brew install awscli  # macOS
# or: apt-get install awscli  # Linux

# Configure AWS credentials
aws configure

# Test KMS access
aws kms encrypt \
  --key-id your-kms-key-id \
  --plaintext "test-secret"
```

**Development:**
```bash
cd agent-7-trust/services/control-plane
npm run dev
```

**Testing:**
```bash
# Test encryption/decryption
npm run test -- secrets

# Test redaction
npm run test -- redaction
```

**Key files:**
- `services/control-plane/src/routes/secrets.ts`
- `services/control-plane/src/lib/encryption.ts`
- `services/control-plane/src/lib/redaction.ts`

---

### Agent 8 (DELIGHT) - SDK & DX

**Worktree location:** `agent-8-delight/`

**Setup:**
```bash
cd agent-8-delight/packages/sdk
python3.11 -m venv venv
source venv/bin/activate
pip install -e ".[dev]"
```

**Development:**
```bash
# Test SDK locally
cd services/runner/samples/extract-company
python main.py
```

**Sample app creation:**
```bash
# Create new sample
mkdir services/runner/samples/my-sample
cd services/runner/samples/my-sample

# Create main.py, requirements.txt, test_main.py
```

**Testing:**
```bash
# Test all samples
cd services/runner
pytest samples/*/test_*.py
```

**Key files:**
- `packages/sdk/src/` - SDK implementation
- `services/runner/samples/` - Sample FastAPI apps
- `services/runner/samples/extract-company/` - Golden demo

---

### Agent 9 (FINOPS) - Infrastructure & Cost

**Worktree location:** `agent-9-finops/`

**Setup:**
```bash
cd agent-9-finops/services/control-plane
npm install
```

**Infrastructure:**
```bash
# Terraform (if using)
cd infra/terraform
terraform init
terraform plan
```

**Development:**
```bash
# Test rate limiting middleware
cd services/control-plane
npm run test -- middleware
```

**Key files:**
- `services/control-plane/src/middleware/rate-limit.ts`
- `services/control-plane/src/middleware/quota.ts`
- `infra/scripts/retention-cleanup.ts`

---

### Agent 10 (CUTTER) - Guardrails & Reviews

**Worktree location:** `agent-10-cutter/`

**Setup:** No specific dev environment (reviews only)

**Responsibilities:**
```bash
# Review all PRs
# Maintain docs/non_goals.md
# Maintain docs/scope_cut_plan.md
# Update .github/PULL_REQUEST_TEMPLATE.md
```

**Key files:**
- `docs/non_goals.md`
- `docs/scope_cut_plan.md`
- `docs/review_gate.md`
- `.github/PULL_REQUEST_TEMPLATE.md`

---

## Common Development Tasks

### Start All Services

```bash
# Terminal 1: Web UI
cd apps/web && npm run dev

# Terminal 2: Control Plane API
cd services/control-plane && npm run dev

# Terminal 3: Modal Runner (optional)
cd services/runner && source venv/bin/activate && modal serve src/modal_app.py
```

### Run All Tests

```bash
# Root level
npm run test

# Specific workspace
cd packages/shared && npm run test
cd services/runner && pytest
```

### Build for Production

```bash
# Build all TypeScript packages
npm run build

# Build Python packages
cd services/runner && pip install -e .
```

### Lint & Format

```bash
# TypeScript
npm run lint
npm run format

# Python
cd services/runner
black src/
ruff src/
```

---

## Database Setup

### Local PostgreSQL (Optional)

**Using Docker:**
```bash
docker run -d \
  --name execution-layer-db \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=execution_layer \
  -p 5432:5432 \
  postgres:16
```

**Apply schema:**
```bash
psql -h localhost -U postgres -d execution_layer \
  -f services/control-plane/src/db/schema.sql
```

### Supabase (Recommended)

1. Create project at https://supabase.com
2. Copy connection string
3. Add to `.env.local`
4. Apply schema via Supabase dashboard SQL editor

---

## IDE Setup

### VS Code (Recommended)

**Extensions:**
```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "ms-python.python",
    "ms-python.vscode-pylance",
    "bradlc.vscode-tailwindcss",
    "ms-playwright.playwright"
  ]
}
```

**Settings:**
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "python.defaultInterpreterPath": "${workspaceFolder}/services/runner/venv/bin/python",
  "python.linting.enabled": true,
  "python.linting.ruffEnabled": true,
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

---

## Troubleshooting

### "npm install fails"

**Cause:** Node version mismatch

**Solution:**
```bash
node --version  # Should be >= 18
npm --version   # Should be >= 9

# If wrong version, install nvm and switch
nvm install 18
nvm use 18
```

### "Python module not found"

**Cause:** Virtual environment not activated

**Solution:**
```bash
cd services/runner
source venv/bin/activate  # See (venv) in prompt
pip list  # Verify packages installed
```

### "Modal authentication fails"

**Cause:** Missing Modal token

**Solution:**
```bash
modal token new
# Follow prompts to authenticate

# Verify
modal token get
```

### "Database connection fails"

**Cause:** Missing environment variables or wrong connection string

**Solution:**
```bash
# Check .env.local exists
cat services/control-plane/.env.local

# Test connection
psql $DATABASE_URL -c "SELECT 1"
```

### "TypeScript errors in IDE but builds fine"

**Cause:** IDE using wrong TypeScript version

**Solution:**
```bash
# In VS Code, Cmd+Shift+P → "TypeScript: Select TypeScript Version"
# Choose "Use Workspace Version"
```

---

## Git Workflow for Agents

### Daily Development

```bash
# 1. Start in your worktree
cd agent-X-name/

# 2. Verify branch
git status  # Should show agent-X/feature-name

# 3. Pull latest from main
git fetch origin main
git merge origin/main

# 4. Make changes
# ... edit files ...

# 5. Commit frequently
git add .
git commit -m "feat(agent-X): description"

# 6. Push to your branch
git push origin HEAD
```

### Staying in Sync

```bash
# Pull main daily
git fetch origin main
git merge origin/main

# If conflicts, resolve and commit
git add .
git commit -m "merge: resolve conflicts from main"
```

---

## Performance Tips

### Faster TypeScript Compilation

```bash
# Use --incremental flag (already in tsconfig.json)
npm run build

# Skip type checking during development
npm run dev  # Next.js skips type checking by default
```

### Faster Python Tests

```bash
# Run only fast tests
pytest -m "not slow"

# Run in parallel (if pytest-xdist installed)
pytest -n auto

# Skip coverage for speed
pytest --no-cov
```

### Faster npm install

```bash
# Use npm ci instead of npm install (in CI)
npm ci

# Or use pnpm for faster installs
npm install -g pnpm
pnpm install
```

---

## Status: ✅ DEVELOPMENT ENVIRONMENT READY

All agents have complete setup instructions.

Next: Agents set up their environments and begin implementation.
