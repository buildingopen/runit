# Context System Implementation - Agent 6 (MEMORY)

## Overview

The Context system allows mounting reusable metadata and data to runs, providing a way to share information across multiple executions without re-fetching or storing secrets.

## Architecture

```
┌─────────────────┐
│  Control Plane  │
│                 │
│ - Fetch URL     │
│ - Validate      │
│ - Store         │
│ - Serve to runs │
└────────┬────────┘
         │
         │ context_ref
         ▼
┌─────────────────┐
│     Runner      │
│                 │
│ - Mount context │
│ - /context/*.json
└────────┬────────┘
         │
         │ Read files
         ▼
┌─────────────────┐
│   User Code     │
│                 │
│ - Read context  │
│ - Use SDK       │
└─────────────────┘
```

## Components

### 1. Control Plane Routes (`services/control-plane/src/routes/context.ts`)

**Endpoints:**

- `POST /projects/:id/context` - Fetch context from URL
- `GET /projects/:id/context` - List all project contexts
- `GET /projects/:id/context/:cid` - Get specific context
- `PUT /projects/:id/context/:cid` - Refresh context from URL
- `DELETE /projects/:id/context/:cid` - Delete context

**Example:**

```bash
# Fetch context from URL
curl -X POST http://localhost:3001/projects/test-id/context \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "name": "test-company"
  }'

# Response:
{
  "id": "ctx-123",
  "data": {
    "title": "Example Domain",
    "description": "Example website",
    "url": "https://example.com",
    "fetched_at": "2024-12-30T12:00:00Z"
  }
}
```

### 2. Context Fetcher (`services/control-plane/src/context-fetcher.ts`)

**Features:**

- URL validation (HTTP/HTTPS only)
- 10-second timeout
- HTML metadata extraction (title, description, OpenGraph)
- Secret pattern validation
- Size limits (1MB per context, 1MB total per project)

**Forbidden Key Patterns:**

```typescript
*_KEY, *_TOKEN, *_SECRET, PASSWORD, API_KEY, SECRET
```

**Example:**

```typescript
const context = await fetchContextFromURL('https://example.com', 'company');
// Returns:
{
  id: "...",
  name: "company",
  data: {
    title: "...",
    description: "...",
    url: "https://example.com",
    fetched_at: "..."
  }
}
```

### 3. Context Mounter (`services/runner/src/context/mounter.py`)

**Functions:**

- `mount_context(context_ref)` - Mount context to /context/*.json
- `write_context_files(context_data)` - Write JSON files
- `validate_context_size(context_data)` - Enforce size limits
- `list_available_contexts()` - List mounted contexts

**Example:**

```python
from context import mount_context

# Control plane passes context data
context_data = {
    "company": {"name": "ACME", "industry": "SaaS"},
    "prefs": {"theme": "dark"}
}

# Mount to /context/*.json
mounted = mount_context(context_data)
# Creates:
# - /context/company.json (read-only)
# - /context/prefs.json (read-only)
```

### 4. SDK Helpers (`packages/sdk/src/context.py`)

**Functions:**

- `get_context(name)` - Get context data by name
- `list_contexts()` - List available contexts
- `has_context(name)` - Check if context exists
- `get_context_path(name)` - Get file path for context

**User Code Example:**

```python
# In user's FastAPI app
from executionlayer import get_context

@app.post("/extract_company")
async def extract_company(url: str):
    # Get mounted context
    company = get_context("company")
    print(f"Company: {company['name']}")

    # Or read directly
    import json
    with open("/context/company.json") as f:
        company = json.load(f)

    return {"company": company}
```

## Security Features

### 1. Secret Pattern Rejection

Context validation rejects keys matching secret patterns:

```typescript
// ❌ REJECTED
{
  "API_KEY": "sk-1234",
  "SECRET_TOKEN": "abc123"
}

// ✅ ALLOWED
{
  "company_name": "ACME",
  "industry": "SaaS"
}
```

### 2. Size Limits

- **Per context:** 1MB max
- **Total per project:** 1MB max
- **Prevents abuse:** No massive data dumps

### 3. Read-Only Mount

All context files are mounted as read-only (chmod 444):

```python
# User code CANNOT modify context
with open("/context/company.json", "w") as f:  # ❌ Fails
    json.dump(data, f)

# Only reading allowed
with open("/context/company.json") as f:  # ✅ Works
    data = json.load(f)
```

## Data Flow

### 1. Fetch Context

```
User → Control Plane → URL Fetch → Extract Metadata → Validate → Store
```

### 2. Mount Context

```
Control Plane → Runner (context_ref) → Mount to /context/*.json → User Code Reads
```

### 3. Refresh Context

```
User → Control Plane → Re-fetch URL → Update Stored Context
```

## API Reference

### Control Plane API

#### POST /projects/:id/context

Fetch context from URL.

**Request:**

```json
{
  "url": "https://example.com",
  "name": "company"
}
```

**Response:**

```json
{
  "id": "ctx-123",
  "data": {
    "title": "Example Domain",
    "description": "Example website",
    "url": "https://example.com",
    "fetched_at": "2024-12-30T12:00:00Z"
  }
}
```

**Errors:**

- `400` - Invalid URL, validation failed, size limit exceeded
- `500` - Fetch failed, timeout

#### GET /projects/:id/context

List all contexts for a project.

**Response:**

```json
{
  "contexts": [
    {
      "id": "ctx-123",
      "name": "company",
      "url": "https://example.com",
      "created_at": "...",
      "updated_at": "...",
      "fetched_at": "...",
      "size": 1024
    }
  ]
}
```

#### GET /projects/:id/context/:cid

Get specific context data.

**Response:**

```json
{
  "id": "ctx-123",
  "project_id": "proj-456",
  "name": "company",
  "url": "https://example.com",
  "data": {
    "title": "...",
    "description": "..."
  },
  "created_at": "...",
  "updated_at": "...",
  "fetched_at": "..."
}
```

#### PUT /projects/:id/context/:cid

Refresh context from URL.

**Response:**

```json
{
  "id": "ctx-123",
  "data": {
    "title": "...",
    "description": "..."
  },
  "updated_at": "...",
  "fetched_at": "..."
}
```

#### DELETE /projects/:id/context/:cid

Delete context.

**Response:**

```json
{
  "success": true
}
```

## Testing

### Unit Tests

**Control Plane (TypeScript):**

```bash
cd services/control-plane
npm test tests/context.test.ts
```

**Runner (Python):**

```bash
cd services/runner
pytest tests/test_context_mounter.py
pytest tests/test_sdk_context.py
```

### Integration Test

```bash
# Start control plane
cd services/control-plane
npm run dev

# Run acceptance test
./test-context-api.sh
```

## Implementation Checklist

- [x] Context types in shared package
- [x] Context fetcher with URL scraping
- [x] Context validation (no secrets)
- [x] Context routes (CRUD)
- [x] Context mounter (read-only /context/*.json)
- [x] SDK helpers for user code
- [x] Integration with Modal app
- [x] Unit tests
- [x] Integration tests
- [x] Documentation

## Future Enhancements (Not v0)

### v1 Features:

1. **AI-powered extraction**
   - Use LLM to extract structured data from webpages
   - Smart schema inference

2. **Authenticated URLs**
   - Support auth-protected URLs
   - OAuth integration

3. **JavaScript rendering**
   - Use Playwright for dynamic pages
   - Handle SPAs

4. **Context refresh scheduling**
   - Auto-refresh stale context
   - Configurable intervals

5. **Context versioning**
   - Track context changes over time
   - Rollback to previous versions

## Constraints (v0)

- ❌ No automatic refresh (always explicit)
- ❌ No JavaScript rendering (static HTML only)
- ❌ No authenticated URLs
- ❌ No AI extraction
- ❌ No context sharing across projects
- ✅ Max 1MB per context
- ✅ Max 1MB total per project
- ✅ 10-second fetch timeout
- ✅ HTTP/HTTPS only

## Notes for Agent 2 (KERNEL)

When implementing the runner execution logic:

1. **Pass context from control plane:**

```python
run_request = {
    "run_id": "...",
    "project_bundle": "...",
    "endpoint": "...",
    "request_data": {...},
    "secrets": {...},
    "context": get_project_contexts(project_id)  # From context.ts
}
```

2. **Mount context before execution:**

```python
from context import write_context_files

# Mount context
write_context_files(run_request["context"])

# Set env var for SDK
os.environ["EL_CONTEXT_DIR"] = "/context"

# Then execute user code
```

3. **Context is available in user code:**

```python
# User can use SDK
from executionlayer import get_context
company = get_context("company")

# Or read directly
with open("/context/company.json") as f:
    company = json.load(f)
```

## Error Messages

**User-facing errors:**

```
"Context key 'API_KEY' looks like a secret. Use Secrets instead."

"Context data exceeds 1MB limit"

"Total context size for project exceeds 1MB limit"

"Invalid context name. Use only letters, numbers, hyphens, and underscores."

"Request timed out (10s limit)"

"Failed to fetch context: HTTP 404: Not Found"

"Context not found"

"Cannot refresh context without URL"
```

## Completion Status

✅ **All acceptance criteria met:**

1. ✅ Context fetch works from URL
2. ✅ Context mounted in runner at /context/*.json
3. ✅ Context linting rejects secrets
4. ✅ Integration tests pass
5. ✅ CRUD API complete
6. ✅ SDK helpers implemented
7. ✅ Documentation complete

**Ready for integration with Agent 2 (KERNEL) runner implementation.**
