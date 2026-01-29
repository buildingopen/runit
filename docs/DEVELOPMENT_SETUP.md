# Development Environment Setup

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

## Initial Setup

### 1. Clone Repository

```bash
git clone https://github.com/your-org/runtime-ai.git
cd runtime-ai
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

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

**apps/web/.env.local:**
```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_ENABLE_MOCK_AUTH=true
```

**services/control-plane/.env.local:**
```bash
PORT=3001
DATABASE_URL=postgresql://user:pass@localhost:5432/execution_layer
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_KEY=your-service-key
AWS_S3_BUCKET=runtime-ai-artifacts
```

**services/runner/.env.local:**
```bash
MODAL_TOKEN_ID=your-modal-token-id
MODAL_TOKEN_SECRET=your-modal-token-secret
```

**Never commit `.env.local` files.**

### 4. Verify Setup

```bash
# TypeScript compilation
npx tsc --noEmit

# Python syntax
cd services/runner && python -m py_compile src/modal_app.py

# Tests
npm run test
cd services/runner && pytest
```

---

## Start All Services

```bash
# Terminal 1: Web UI
cd apps/web && npm run dev

# Terminal 2: Control Plane API
cd services/control-plane && npm run dev

# Terminal 3: Modal Runner (optional)
cd services/runner && source venv/bin/activate && modal serve src/modal_app.py
```

Open [http://localhost:3000](http://localhost:3000) to access the web interface.

---

## Common Development Tasks

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
  --name runtime-ai-db \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=runtime_ai \
  -p 5432:5432 \
  postgres:16
```

### Supabase (Recommended)

1. Create project at https://supabase.com
2. Copy connection string
3. Add to `.env.local`
4. Apply schema via Supabase dashboard SQL editor

---

## Modal Setup

```bash
# Install Modal CLI
pip install modal

# Authenticate
modal token new

# Test connection
modal run services/runner/src/modal_app.py

# Local development server
modal serve services/runner/src/modal_app.py

# Deploy to Modal
modal deploy services/runner/src/modal_app.py
```

---

## IDE Setup (VS Code)

**Recommended Extensions:**
- ESLint (`dbaeumer.vscode-eslint`)
- Prettier (`esbenp.prettier-vscode`)
- Python (`ms-python.python`)
- Pylance (`ms-python.vscode-pylance`)
- Tailwind CSS IntelliSense (`bradlc.vscode-tailwindcss`)
- Playwright (`ms-playwright.playwright`)

**Settings (`.vscode/settings.json`):**
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "python.defaultInterpreterPath": "${workspaceFolder}/services/runner/venv/bin/python",
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

---

## Troubleshooting

### npm install fails
Node version mismatch. Ensure Node >= 18 and npm >= 9.

### Python module not found
Virtual environment not activated. Run `source venv/bin/activate`.

### Modal authentication fails
Run `modal token new` and follow prompts.

### Database connection fails
Check `.env.local` exists with correct connection string.

### TypeScript errors in IDE but builds fine
In VS Code: Cmd+Shift+P → "TypeScript: Select TypeScript Version" → "Use Workspace Version"
