# Secrets System - Quick Start Guide

## Overview

The Execution Layer Secrets system provides **encrypted storage** and **secure injection** of sensitive environment variables for your FastAPI applications.

## Key Features

- 🔐 **Encrypted at rest** using AES-256-GCM envelope encryption
- 🚫 **Never logged** - Automatic redaction from logs and outputs
- 🔒 **Owner-only** - Secrets never shared via links
- ⚡ **Runtime injection** - Decrypted only when running endpoints
- 🧹 **Ephemeral** - Secrets die with the container

## Usage

### 1. Store a Secret

```bash
curl -X POST http://localhost:3001/projects/:project_id/secrets \
  -H "Content-Type: application/json" \
  -d '{
    "key": "OPENAI_API_KEY",
    "value": "sk-proj1234567890abcdef..."
  }'
```

**Response:**
```json
{
  "id": "uuid",
  "key": "OPENAI_API_KEY",
  "created_at": "2024-12-30T12:34:56Z",
  "updated_at": "2024-12-30T12:34:56Z"
}
```

### 2. List Your Secrets

```bash
curl http://localhost:3001/projects/:project_id/secrets
```

**Response:**
```json
{
  "secrets": [
    {
      "id": "uuid",
      "key": "OPENAI_API_KEY",
      "value": "***",  // Always masked for security
      "created_at": "2024-12-30T12:34:56Z",
      "updated_at": "2024-12-30T12:34:56Z"
    }
  ]
}
```

### 3. Use in Your FastAPI App

Secrets are automatically injected as environment variables:

```python
# main.py
import os
from fastapi import FastAPI

app = FastAPI()

@app.post("/extract_company")
async def extract_company(url: str):
    # Secrets are available via os.getenv()
    api_key = os.getenv("OPENAI_API_KEY")

    # Use the secret
    response = await call_openai_api(api_key, url)

    return response
```

**No configuration needed!** Secrets are injected before your app loads.

### 4. Update a Secret

```bash
curl -X PUT http://localhost:3001/projects/:project_id/secrets/OPENAI_API_KEY \
  -H "Content-Type: application/json" \
  -d '{
    "value": "sk-proj-new-key..."
  }'
```

### 5. Delete a Secret

```bash
curl -X DELETE http://localhost:3001/projects/:project_id/secrets/OPENAI_API_KEY
```

## Security Features

### Automatic Redaction

Secrets are **automatically redacted** from:
- ✅ Logs (stdout/stderr)
- ✅ Response bodies
- ✅ Error messages

**Example:**
```python
# Your code prints:
print(f"Using API key: {os.getenv('OPENAI_API_KEY')}")

# Logs show:
# Using API key: [REDACTED:OPENAI_API_KEY]
```

### Patterns Detected

The system automatically detects and redacts:
- OpenAI keys: `sk-*`
- Google API keys: `AIzaSy*`
- JWT tokens: `eyJ*`
- GitHub tokens: `ghp_*`
- Slack tokens: `xoxb-*`
- Database passwords in connection strings
- Proxy credentials (host:port:user:pass)

### Share Links

When you share an endpoint:
- ❌ Your secrets are **never** included
- ✅ Recipients provide **their own** secrets
- ✅ Your secrets stay **private**

## Common Patterns

### Pattern 1: Multiple Secrets

```bash
# Store multiple secrets
curl -X POST .../secrets -d '{"key": "OPENAI_API_KEY", "value": "sk-..."}'
curl -X POST .../secrets -d '{"key": "STRIPE_API_KEY", "value": "sk_test..."}'
curl -X POST .../secrets -d '{"key": "DATABASE_URL", "value": "postgres://..."}'
```

```python
# Use in your app
import os

openai_key = os.getenv("OPENAI_API_KEY")
stripe_key = os.getenv("STRIPE_API_KEY")
db_url = os.getenv("DATABASE_URL")
```

### Pattern 2: Environment-Specific Secrets

```bash
# Development
curl -X POST .../secrets -d '{"key": "API_URL", "value": "https://dev.api.com"}'

# Production
curl -X PUT .../secrets/API_URL -d '{"value": "https://api.com"}'
```

### Pattern 3: Conditional Secrets

```python
# Optional secrets with fallback
api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    raise ValueError("OPENAI_API_KEY is required")
```

## Best Practices

### ✅ DO:
- Store API keys, tokens, passwords as secrets
- Use descriptive key names (`OPENAI_API_KEY`, not `KEY1`)
- Update secrets when rotating credentials
- Delete unused secrets

### ❌ DON'T:
- Store non-sensitive config in secrets (use context instead)
- Include secrets in your code or requirements.txt
- Hardcode secrets in your FastAPI app
- Log secret values intentionally

## Debugging

### Check if Secrets are Injected

```python
@app.get("/debug/env")
async def debug_env():
    return {
        "has_openai_key": "OPENAI_API_KEY" in os.environ,
        "has_stripe_key": "STRIPE_API_KEY" in os.environ,
    }
```

### Verify Redaction

```python
@app.get("/test/redaction")
async def test_redaction():
    # This will be redacted in logs and response
    api_key = os.getenv("OPENAI_API_KEY")
    print(f"API Key: {api_key}")  # Logs: "API Key: [REDACTED:OPENAI_API_KEY]"
    return {"api_key": api_key}   # Response: {"api_key": "[REDACTED:OPENAI_API_KEY]"}
```

## Troubleshooting

### Secret Not Found

**Problem:** `os.getenv("MY_SECRET")` returns `None`

**Solutions:**
1. Check secret exists: `GET /projects/:id/secrets`
2. Verify key name matches exactly (case-sensitive)
3. Ensure run is using correct project

### Decryption Failed

**Problem:** Run fails with `SECRETS_DECRYPTION_FAILED`

**Solutions:**
1. Check `MASTER_ENCRYPTION_KEY` environment variable is set
2. Verify Modal secret is configured: `modal secret list`
3. Check control-plane and runner use same master key

### Redaction Too Aggressive

**Problem:** Legitimate data being redacted

**Solutions:**
1. Avoid using secret-like patterns in normal data
2. Check if value matches a redaction pattern
3. Use different naming conventions for non-secrets

## API Reference

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/projects/:id/secrets` | Store a secret |
| GET | `/projects/:id/secrets` | List secrets (masked) |
| PUT | `/projects/:id/secrets/:key` | Update a secret |
| DELETE | `/projects/:id/secrets/:key` | Delete a secret |

### Request/Response Format

**Store Secret:**
```json
// Request
{
  "key": "SECRET_NAME",
  "value": "actual-secret-value"
}

// Response
{
  "id": "uuid",
  "key": "SECRET_NAME",
  "created_at": "ISO-8601",
  "updated_at": "ISO-8601"
}
```

**List Secrets:**
```json
// Response
{
  "secrets": [
    {
      "id": "uuid",
      "key": "SECRET_NAME",
      "value": "***",  // Always masked
      "created_at": "ISO-8601",
      "updated_at": "ISO-8601"
    }
  ]
}
```

## Security Model

```
┌─────────────────────────────────────────────────────┐
│  Your Secret                                         │
│  "sk-proj1234567890abcdef..."                       │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │  KMS Encryption        │
         │  AES-256-GCM           │
         └───────────┬───────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │  Database              │
         │  (encrypted blob)      │
         └───────────┬───────────┘
                     │
                     │ Run Created
                     ▼
         ┌───────────────────────┐
         │  Decrypt & Inject      │
         │  os.environ[key]=val   │
         └───────────┬───────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │  Your FastAPI App      │
         │  os.getenv("SECRET")   │
         └───────────┬───────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │  Redaction Layer       │
         │  Logs & Outputs        │
         └───────────┬───────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │  Container Dies        │
         │  Secrets Gone          │
         └───────────────────────┘
```

## Support

For issues or questions:
- Check [SECRETS-VERIFICATION.md](SECRETS-VERIFICATION.md) for detailed implementation
- Review [AGENT-7-SECRETS-IMPLEMENTATION.md](AGENT-7-SECRETS-IMPLEMENTATION.md) for technical details
- See [CLAUDE.md Section 9](CLAUDE.md#9-secrets-model-detailed) for security contract
