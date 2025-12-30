# Agent 6 (MEMORY) - Context System

## Quick Start

This directory contains the **Context system** implementation for Execution Layer v0.

### What is Context?

Context allows you to mount reusable metadata/data to runs without storing secrets.

**Example:**
```bash
# Fetch company info from URL
curl -X POST http://localhost:3001/projects/proj-123/context \
  -d '{"url": "https://example.com", "name": "company"}'

# Your FastAPI app can now access it
from executionlayer import get_context

@app.post("/extract")
def extract():
    company = get_context("company")
    return {"name": company["name"]}
```

---

## Features

✅ **Fetch from URL** - Extract metadata from any website
✅ **Read-only mount** - Context files mounted at /context/*.json
✅ **Secret protection** - Rejects API keys, tokens, passwords
✅ **Size limits** - Max 1MB per context, 1MB per project
✅ **SDK helpers** - Simple Python API for user code

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /projects/:id/context | Fetch from URL |
| GET | /projects/:id/context | List all contexts |
| GET | /projects/:id/context/:cid | Get specific context |
| PUT | /projects/:id/context/:cid | Refresh from URL |
| DELETE | /projects/:id/context/:cid | Delete context |

---

## File Structure

```
agent-6-memory/
├── services/
│   ├── control-plane/src/
│   │   ├── routes/context.ts         # CRUD API
│   │   ├── context-fetcher.ts        # URL scraper
│   │   └── tests/context.test.ts     # Tests
│   └── runner/src/
│       ├── context/mounter.py        # Mount logic
│       └── tests/test_*.py           # Tests
├── packages/
│   ├── shared/src/types/index.ts     # Types
│   └── sdk/src/context.py            # SDK helpers
├── test-context-api.sh               # Acceptance test
├── CONTEXT_IMPLEMENTATION.md         # Full docs
└── AGENT-6-COMPLETION-REPORT.md     # Completion report
```

---

## Testing

### Run Acceptance Test

```bash
# Start control plane
cd services/control-plane
npm run dev

# Run test (in another terminal)
./test-context-api.sh
```

### Run Unit Tests

```bash
# TypeScript tests
cd services/control-plane
npm test

# Python tests
cd services/runner
pytest
```

---

## Documentation

- **[CONTEXT_IMPLEMENTATION.md](./CONTEXT_IMPLEMENTATION.md)** - Full implementation guide
- **[AGENT-6-COMPLETION-REPORT.md](./AGENT-6-COMPLETION-REPORT.md)** - Completion report

---

## Status

✅ **COMPLETE** - All acceptance criteria met

Ready for integration with Agent 2 (KERNEL) runner implementation.

---

## Quick Examples

### Fetch Context

```bash
curl -X POST http://localhost:3001/projects/test/context \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "name": "company"
  }'
```

### Use in FastAPI App

```python
from executionlayer import get_context

@app.post("/process")
def process():
    # Get mounted context
    company = get_context("company")

    # Use the data
    return {
        "company": company["name"],
        "industry": company["industry"]
    }
```

### List Available Contexts

```python
from executionlayer import list_contexts

contexts = list_contexts()
print(f"Available: {contexts}")
# Output: ['company', 'user_prefs']
```

---

## Security

✅ **No secrets** - Validation rejects keys like `API_KEY`, `SECRET_TOKEN`
✅ **Read-only** - All files mounted as read-only (chmod 444)
✅ **Size limits** - Max 1MB per context, 1MB per project
✅ **Timeout** - 10-second fetch timeout

---

## Integration

For Agent 2 (KERNEL):

```python
from context import write_context_files
from routes.context import get_project_contexts

# Get contexts
contexts = get_project_contexts(project_id)

# Mount before execution
write_context_files(contexts)
os.environ["EL_CONTEXT_DIR"] = "/context"

# Execute user code (context is now available)
```

---

**Agent 6 (MEMORY) - Context System Implementation Complete** 🎯
