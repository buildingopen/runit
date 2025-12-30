# Agent 3 (BRIDGE) - Quick Start Guide

## 🚀 Get Started in 3 Steps

### Step 1: Install Python Dependencies

```bash
cd services/control-plane/src/lib/openapi
pip install -r requirements.txt
```

### Step 2: Start Python Bridge Service

```bash
python bridge.py
```

Output:
```
INFO:     Started server process [12345]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8001
```

### Step 3: Test with Example Script

In another terminal:

```bash
cd services/control-plane
npx tsx src/lib/openapi/example.ts
```

Expected output:
```
Checking bridge service health...
✅ Bridge service is healthy

Extracting OpenAPI from: ./tests/openapi/fixtures
Entrypoint: auto-detect

✅ Extraction successful

Entrypoint: simple_app:app
Detection method: scan
Confidence: high

Found 3 endpoints:

1. GET /
   Summary: Root endpoint

2. POST /extract_company
   Summary: Extract company info from URL

3. GET /health
   Summary: Health check

--- OpenAPI Schema (truncated) ---
Title: Simple Test App
Version: 0.1.0
Paths: 3

✅ Example completed successfully
```

## 🔧 Using in Your Code

```typescript
import { createExtractor } from './lib/openapi';

// Create extractor
const extractor = createExtractor();

// Extract OpenAPI from a project
const response = await extractor.extract({
  project_id: 'my-project',
  version_id: 'v1.0.0',
  zip_path: '/path/to/extracted/fastapi/project'
});

// Check for errors
if (response.error) {
  console.error('Error:', response.error.error_message);
  console.log('Fix:', response.error.suggested_fix);
  return;
}

// Use the extracted data
console.log('Entrypoint:', response.entrypoint);
console.log('Endpoints:', response.endpoints);
console.log('Schema:', response.openapi_schema);
```

## 📋 Common Use Cases

### Auto-Detect Entrypoint

```typescript
const response = await extractor.extract({
  project_id: 'abc-123',
  version_id: 'def-456',
  zip_path: './my-fastapi-app'
  // entrypoint not specified - auto-detected
});

console.log('Detected:', response.entrypoint);
console.log('Confidence:', response.entrypoint_detection?.confidence);
```

### Use Custom Entrypoint

```typescript
const response = await extractor.extract({
  project_id: 'abc-123',
  version_id: 'def-456',
  zip_path: './my-fastapi-app',
  entrypoint: 'myapp.server:application' // Custom
});
```

### Check GPU Requirements

```typescript
const { endpoints } = response;

endpoints.forEach(endpoint => {
  if (endpoint.requires_gpu) {
    console.log(`${endpoint.path} requires GPU`);
  }
});
```

### Handle Errors Gracefully

```typescript
const response = await extractor.extract(request);

if (response.error) {
  switch (response.error.error_class) {
    case 'import_error':
      // Show user to check dependencies
      break;
    case 'no_fastapi_app':
      // Guide user to create FastAPI instance
      break;
    case 'timeout':
      // Suggest optimizing import
      break;
    default:
      // Generic error handling
  }
}
```

## 🧪 Running Tests

### Unit Tests (No Bridge Needed)

```bash
npm run test services/control-plane/tests/openapi/
```

This runs:
- Entrypoint detection tests
- Error classification tests
- Validation tests

### Integration Tests (Requires Bridge)

Terminal 1:
```bash
python services/control-plane/src/lib/openapi/bridge.py
```

Terminal 2:
```bash
npm run test services/control-plane/tests/openapi/
```

This runs:
- Full extraction tests
- Real FastAPI app imports
- Error handling tests

## 🐛 Troubleshooting

### Bridge Not Running

**Error**: `Failed to connect to OpenAPI bridge service`

**Fix**:
```bash
# Check if bridge is running
curl http://localhost:8001/health

# If not running, start it
python services/control-plane/src/lib/openapi/bridge.py
```

### Import Timeout

**Error**: `error_class: "timeout"`

**Cause**: User's app takes >30s to import

**Fix**: Tell user to:
1. Move heavy initialization to endpoints
2. Lazy-load ML models
3. Remove top-level expensive operations

### Entrypoint Not Found

**Error**: `error_class: "entrypoint_not_found"`

**Cause**: Can't find FastAPI app in common patterns

**Fix**: Tell user to:
1. Use standard naming: `main.py` with `app = FastAPI()`
2. Or create `executionlayer.toml` with custom entrypoint
3. Or pass entrypoint manually in request

### Missing Dependencies

**Error**: `error_class: "dependency_missing"`

**Cause**: User's app imports packages not in requirements.txt

**Fix**: Tell user to:
```bash
# Add missing package to requirements.txt
echo "pandas==2.0.0" >> requirements.txt
```

## 📚 Next Steps

1. **Read Full Documentation**: See `services/control-plane/src/lib/openapi/README.md`
2. **Review API Contracts**: See `AGENT-3-SUMMARY.md`
3. **Check Test Fixtures**: See `services/control-plane/tests/openapi/fixtures/`
4. **Integrate with Agent 5**: Use extracted endpoints for form generation

## 🎯 Key Features

✅ **Auto-Detection**: Finds FastAPI app in 7 common patterns
✅ **Error Classification**: 8 error types with actionable fixes
✅ **Timeout Protection**: 30s import timeout prevents hanging
✅ **GPU Detection**: Auto-detects GPU requirements from keywords
✅ **Type-Safe**: Full TypeScript types and Pydantic validation
✅ **Real Tests**: Tests use actual FastAPI apps, not mocks

## 💡 Tips

1. **Always check health first**:
   ```typescript
   const isHealthy = await extractor.healthCheck();
   if (!isHealthy) throw new Error('Bridge not running');
   ```

2. **Use error suggested fixes**:
   ```typescript
   if (response.error) {
     showUserMessage(response.error.suggested_fix);
   }
   ```

3. **Log entrypoint detection for debugging**:
   ```typescript
   console.log('Entrypoint:', response.entrypoint);
   console.log('Detection:', response.entrypoint_detection);
   ```

4. **Cache extracted schemas by version hash** (future enhancement)

## 🔗 Related Documentation

- **Full Architecture**: `services/control-plane/src/lib/openapi/README.md`
- **Agent Summary**: `AGENT-3-SUMMARY.md`
- **Verification Checklist**: `VERIFICATION.md`
- **Test Suite**: `services/control-plane/tests/openapi/extractor.test.ts`
