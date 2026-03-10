# Development Environment Setup

## Prerequisites

### Required Software

| Tool | Version | Purpose |
|------|---------|---------|
| **Node.js** | >= 20.0.0 | TypeScript/JavaScript runtime |
| **npm** | >= 9.0.0 | Package manager |
| **Python** | >= 3.11 | Python runtime for Runner |
| **Git** | >= 2.30 | Version control |
| **Docker** | Latest | Container execution backend |

### Optional Tools

| Tool | Purpose |
|------|---------|
| **VS Code** | Recommended IDE |
| **Postman/Insomnia** | API testing |

---

## Initial Setup

### 1. Clone Repository

```bash
git clone https://github.com/buildingopen/runit.git
cd runit
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

### 3. Environment Variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

**apps/web/.env.local:**
```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_API_KEY=your-api-key
```

**services/control-plane/.env.local:**
```bash
PORT=3001
MASTER_ENCRYPTION_KEY=$(openssl rand -base64 32)
COMPUTE_BACKEND=docker
API_KEY=your-api-key
```

**Never commit `.env.local` files.**

### 4. Verify Setup

```bash
# TypeScript compilation
npx tsc --noEmit

# Tests
npm run test
cd services/runner && pytest
```

---

## Start All Services

### Option A: Docker (recommended)

```bash
docker-compose up --build
```

Open [http://localhost:3001](http://localhost:3001) to access the API.

### Option B: Manual

```bash
# Terminal 1: Web UI
cd apps/web && npm run dev

# Terminal 2: Control Plane API
cd services/control-plane && npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the web UI.

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
```

### Lint & Format

```bash
# TypeScript
npm run lint
npm run format

# Python
cd services/runner
black src/
ruff check src/
```

---

## IDE Setup (VS Code)

**Recommended Extensions:**
- ESLint (`dbaeumer.vscode-eslint`)
- Prettier (`esbenp.prettier-vscode`)
- Python (`ms-python.python`)
- Pylance (`ms-python.vscode-pylance`)
- Tailwind CSS IntelliSense (`bradlc.vscode-tailwindcss`)

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
Node version mismatch. Ensure Node >= 20 and npm >= 9.

### Python module not found
Virtual environment not activated. Run `source venv/bin/activate`.

### Docker socket permission denied
Add your user to the docker group: `sudo usermod -aG docker $USER`

### TypeScript errors in IDE but builds fine
In VS Code: Cmd+Shift+P > "TypeScript: Select TypeScript Version" > "Use Workspace Version"
