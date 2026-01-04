# Modal App Overview - execution-layer-runtime

## Yes, This Was Created By Me (Claude)

The Modal app `execution-layer-runtime` was built and deployed during our work session on **December 30, 2025**.

## Where to See It

### 1. In Your Modal Dashboard
```bash
# List all your Modal apps
python3 -m modal app list

# You'll see:
# execution-layer-runtime | deployed | 0 tasks | 2025-12-30 18:28 CET
```

Visit: https://modal.com/apps (your Modal dashboard)

### 2. In the Codebase

**Main App File:**
```
/Users/federicodeponte/Downloads/runtime ai/execution-layer/services/runner/src/modal_app.py
```

This file defines:
- **App Name:** `execution-layer-runtime`
- **CPU Function:** `run_endpoint_cpu` (2 CPU, 4GB RAM, 60s timeout)
- **GPU Function:** `run_endpoint_gpu` (4 CPU + A10G GPU, 16GB RAM, 180s timeout)
- **Base Image:** Python 3.11 with FastAPI, httpx, pandas, numpy, beautifulsoup4, etc.

**Executor Code:**
```
/Users/federicodeponte/Downloads/runtime ai/execution-layer/services/runner/src/execute/executor.py
```

This is the core execution engine that:
1. Extracts your FastAPI ZIP
2. Installs dependencies from requirements.txt
3. Imports your FastAPI app
4. Executes endpoints using httpx.AsyncClient (no ports, in-process)
5. Collects artifacts from /artifacts
6. Returns results with secrets redacted

### 3. How It Was Deployed

**Command used:**
```bash
cd "/Users/federicodeponte/Downloads/runtime ai/execution-layer/services/runner/src"
python3 -m modal deploy modal_app.py
```

**Deployment output:**
```
✓ Initialized. View run at https://modal.com/apps/ap-lHWLkmuODs3RsuoiMQpqyz
✓ Created objects.
├── 🔨 Created mount /Users/.../services/runner/src/execute
├── 🔨 Created mount /Users/.../services/runner/src/build
├── 🔨 Created mount /Users/.../services/runner/src/artifacts
├── 🔨 Created mount /Users/.../services/runner/src/errors
├── 🔨 Created mount /Users/.../services/runner/src/security
├── 🔨 Created run_endpoint_cpu => ap-lHWLkmuODs3RsuoiMQpqyz::fn-...
└── 🔨 Created run_endpoint_gpu => ap-lHWLkmuODs3RsuoiMQpqyz::fn-...
✓ App deployed! 🎉
```

## How It Works

### Architecture

```
Control Plane (localhost:3001)
    ↓
Python subprocess calls Modal SDK
    ↓
Modal.com executes run_endpoint_cpu/gpu
    ↓
Executor extracts ZIP, imports FastAPI app
    ↓
httpx.AsyncClient executes endpoint in-process
    ↓
Returns result back to control-plane
```

### What Makes It Special

1. **Single App, Multiple Projects:** One Modal app serves ALL user projects (not one app per user)
2. **In-Process Execution:** No uvicorn, no ports - uses ASGI transport directly
3. **Automatic Dependencies:** Installs requirements.txt on first run, caches by hash
4. **Security:** Runs as non-root, secrets auto-redacted, environment cleaned up
5. **Two Lanes:** CPU for most tasks, GPU (A10G) for ML workloads

### File Structure

```
services/runner/src/
├── modal_app.py              ← MAIN: Defines the Modal app
├── execute/
│   └── executor.py           ← Core: Runs FastAPI endpoints
├── build/
│   └── deps.py               ← Installs pip dependencies
├── artifacts/
│   └── collector.py          ← Collects files from /artifacts
├── security/
│   ├── redaction.py          ← Redacts secrets from logs/output
│   └── kms_client.py         ← Decrypts secrets
└── errors/
    └── taxonomy.py           ← Classifies error types

samples/
└── hello-world/              ← Test FastAPI app
    ├── main.py
    └── requirements.txt
```

## Secrets Configuration

**Created on Modal:**
```bash
python3 -m modal secret create runner-secrets \
  MASTER_ENCRYPTION_KEY="dev-default-encryption-key-32chars!!"
```

This secret is injected into both `run_endpoint_cpu` and `run_endpoint_gpu` functions.

## Test Results

**Successful Executions:**

1. **POST /greet** with `{"name": "World"}`
   - Result: `{"message": "Hello, World!"}`
   - Duration: 5.3 seconds
   - Status: success ✅

2. **GET /**
   - Result: `{"message": "Hello World"}`
   - Duration: 0.7 seconds
   - Status: success ✅

## How to Verify It's Running

```bash
# Check Modal apps
python3 -m modal app list

# See live logs (when running)
python3 -m modal app logs execution-layer-runtime

# Test via control-plane API
curl -s -X POST http://localhost:3001/runs \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "e8185146-0e59-47cc-8268-f9fcb45ed1cc",
    "version_id": "5d23b103-ff24-48c2-9527-118545006888",
    "endpoint_id": "post--greet",
    "json": {"name": "Test"},
    "lane": "cpu"
  }'
```

## Key Code Snippets

### Modal Function Definition (modal_app.py)

```python
@app.function(
    image=base_image,
    cpu=2.0,
    memory=4096,
    timeout=300,
    secrets=[modal.Secret.from_name("runner-secrets")],
)
def run_endpoint_cpu(payload: dict) -> dict:
    from execute.executor import execute_endpoint
    return execute_endpoint(
        payload=payload,
        max_timeout=60,
        max_memory_mb=4096,
        lane="cpu"
    )
```

### In-Process Execution (executor.py)

```python
async def execute_request():
    from httpx import ASGITransport, AsyncClient
    
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://testserver"
    ) as client:
        response = await client.request(
            method=method,
            url=path,
            params=params,
            json=json_data,
            headers=headers,
            files=files,
            timeout=max_timeout,
        )
        return response

response = asyncio.run(asyncio.wait_for(execute_request(), timeout=max_timeout))
```

## Summary

- ✅ **Built by:** Claude (AI assistant)
- ✅ **When:** December 30, 2025
- ✅ **Where:** Modal.com (your account)
- ✅ **Status:** Deployed and working
- ✅ **Tested:** Multiple successful executions
- ✅ **Code:** In this repository under `services/runner/`

**This is real infrastructure running real code, not a mockup.**
