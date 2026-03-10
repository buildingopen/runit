# OpenAPI Extraction System

TypeScript OpenAPI extractor that loads user FastAPI apps and extracts their schemas using a Python bridge service.

## Architecture

```
TypeScript (Control Plane)           Python (Bridge Service)
┌─────────────────────┐              ┌──────────────────────┐
│  OpenAPIExtractor   │─────HTTP────▶│  FastAPI Service     │
│                     │              │                      │
│  - Entrypoint       │              │  - Import user app   │
│    detection        │              │  - Call app.openapi()│
│  - Error            │              │  - Extract endpoints │
│    classification   │              │  - Timeout (30s)     │
│                     │              │                      │
└─────────────────────┘              └──────────────────────┘
```

## Components

### 1. TypeScript Layer

#### `extractor.ts`
Main OpenAPI extraction orchestrator:
- Detects entrypoint (or uses custom)
- Calls Python bridge service
- Classifies errors using taxonomy
- Returns structured `ExtractOpenAPIResponse`

#### `entrypoint-detector.ts`
Entrypoint detection logic:
- Scans for FastAPI app in common locations
- Tries patterns: `main:app`, `app:app`, `api:app`, etc.
- Supports custom entrypoint override
- Returns confidence level

#### Error Handling (`../errors/`)
- `taxonomy.ts`: Error classes and suggested fixes
- `classifier.ts`: Pattern matching to classify errors

### 2. Python Bridge Service

#### `bridge.py`
FastAPI service that:
- Accepts POST `/extract-openapi` with `{zip_path, entrypoint, timeout_seconds}`
- Imports user FastAPI app with timeout protection
- Extracts OpenAPI schema via `app.openapi()`
- Returns schema + endpoint list + error classification

**Key Features:**
- 30s import timeout (configurable)
- Proper signal handling for timeout
- Error classification (import, syntax, timeout, etc.)
- GPU requirement detection from endpoint descriptions

## Usage

### Start Python Bridge Service

```bash
cd services/control-plane/src/lib/openapi
python bridge.py
# Runs on http://localhost:8001
```

Or with custom port:
```bash
uvicorn bridge:app --host 0.0.0.0 --port 8001
```

### Use TypeScript Extractor

```typescript
import { createExtractor } from './lib/openapi/extractor';

const extractor = createExtractor({
  bridgeUrl: 'http://localhost:8001',
  timeout: 45000, // 45s total
  importTimeout: 30 // 30s for Python import
});

const response = await extractor.extract({
  project_id: 'abc-123',
  version_id: 'def-456',
  zip_path: '/path/to/extracted/project',
  entrypoint: 'main:app' // Optional, auto-detected if omitted
});

if (response.error) {
  console.error('Extraction failed:', response.error);
  console.log('Suggested fix:', response.error.suggested_fix);
} else {
  console.log('OpenAPI schema:', response.openapi_schema);
  console.log('Endpoints:', response.endpoints);
}
```

### Health Check

```typescript
const isHealthy = await extractor.healthCheck();
if (!isHealthy) {
  console.error('Python bridge service is not running');
}
```

## API Contracts

### ExtractOpenAPIRequest

```typescript
interface ExtractOpenAPIRequest {
  project_id: string;
  version_id: string;
  zip_path: string; // Path to extracted ZIP
  entrypoint?: string; // Optional, e.g., "main:app"
}
```

### ExtractOpenAPIResponse

```typescript
interface ExtractOpenAPIResponse {
  openapi_schema: unknown; // OpenAPI 3.1 JSON
  endpoints: EndpointMeta[];
  entrypoint: string;
  entrypoint_detection?: EntrypointResult;
  error?: ClassifiedError;
}
```

### EndpointMeta

```typescript
interface EndpointMeta {
  endpoint_id: string; // "POST_/extract_company"
  method: string; // "POST"
  path: string; // "/extract_company"
  summary?: string;
  description?: string;
  requires_gpu?: boolean; // Detected from keywords
}
```

### ClassifiedError

```typescript
interface ClassifiedError {
  error_class: ErrorClass;
  error_message: string;
  suggested_fix: string;
  technical_details?: string;
}

type ErrorClass =
  | 'import_error'
  | 'no_fastapi_app'
  | 'schema_extraction_failed'
  | 'timeout'
  | 'dependency_missing'
  | 'syntax_error'
  | 'circular_import'
  | 'entrypoint_not_found';
```

## Error Classification

Errors are automatically classified with actionable suggestions:

| Error Class | Common Causes | Suggested Fix |
|-------------|---------------|---------------|
| `import_error` | Missing imports, broken code | Check imports and dependencies |
| `no_fastapi_app` | No `app = FastAPI()` | Create FastAPI instance |
| `timeout` | Import takes >30s | Move heavy init to endpoints |
| `dependency_missing` | Package not in requirements.txt | Add missing package |
| `syntax_error` | Python syntax errors | Fix syntax with `python -m py_compile` |
| `circular_import` | Circular dependencies | Restructure code |
| `entrypoint_not_found` | Can't find FastAPI app | Use standard patterns or set custom entrypoint |

## Entrypoint Detection

### Auto-Detection Priority

1. **Custom entrypoint** (if provided)
2. **Scan candidate files** for `FastAPI()` instantiation
3. **Try common patterns** in order:
   - `main:app`
   - `app:app`
   - `api:app`
   - `src.main:app`
   - `api.main:app`
   - `server:app`

### Custom Entrypoint

Create `runit.toml` in project root:

```toml
entrypoint = "mymodule:application"
```

Or pass directly:

```typescript
const response = await extractor.extract({
  // ...
  entrypoint: 'custom_module:my_app'
});
```

## Testing

### Unit Tests (TypeScript)

```bash
npm run test services/control-plane/tests/openapi/extractor.test.ts
```

### Integration Tests

Requires Python bridge service to be running:

```bash
# Terminal 1: Start bridge
python services/control-plane/src/lib/openapi/bridge.py

# Terminal 2: Run tests
npm run test services/control-plane/tests/openapi/extractor.test.ts
```

### Test Fixtures

Located in `tests/openapi/fixtures/`:
- `simple_app.py` - Basic FastAPI app
- `no_app.py` - No FastAPI instance
- `broken_import.py` - Import error
- `custom_entrypoint.py` - Custom variable name
- `syntax_error.py` - Python syntax error
- `slow_import.py` - Exceeds timeout

## Environment Variables

```bash
# Python bridge URL (default: http://localhost:8001)
OPENAPI_BRIDGE_URL=http://localhost:8001
```

## Security

### Timeout Protection
- Import timeout: 30s (configurable)
- Total request timeout: 45s
- Prevents hanging on infinite loops or heavy imports

### Isolation
- Each extraction runs in isolated Python process
- No cross-project contamination
- Safe handling of user code errors

### Error Sanitization
- Sensitive paths removed from error messages
- Only relevant error details exposed
- Technical details available for debugging

## Troubleshooting

### Bridge service not responding

```bash
# Check if service is running
curl http://localhost:8001/health

# Expected: {"status": "healthy"}
```

### Import timeout errors

User code is taking >30s to import. Suggestions:
- Move heavy initialization to endpoints
- Lazy-load ML models
- Remove top-level expensive operations

### Entrypoint not found

Check:
1. File naming: `main.py`, `app.py`, or `api.py`
2. Variable naming: `app`, not `application` or custom name
3. FastAPI instantiation: `app = FastAPI()`

If using custom:
- Create `runit.toml` with entrypoint
- Or pass via API: `entrypoint: "module:variable"`

## Future Enhancements

- [ ] Caching of extracted schemas by version hash
- [ ] Parallel extraction for multiple projects
- [ ] OpenAPI schema validation
- [ ] Auto-fix suggestions for common errors
- [ ] Support for async lifespan events detection
- [ ] Detect actual GPU usage (not just keywords)
