# Agent 3 (BRIDGE) - OpenAPI Extraction System

**Status**: ✅ COMPLETE
**Branch**: `agent-3/openapi-bridge`
**Worktree**: `agent-3-bridge/`

## Mission

Build the OpenAPI extraction system that loads user FastAPI apps and extracts their schemas.

## What Was Built

### 1. TypeScript OpenAPI Extractor (`services/control-plane/src/lib/openapi/`)

#### `extractor.ts` - Main Orchestrator
- Calls Python bridge service to extract OpenAPI schemas
- Handles entrypoint detection (auto or custom)
- Classifies errors using error taxonomy
- Returns structured `ExtractOpenAPIResponse`

**Key Features:**
- 45s total timeout (configurable)
- Health check for bridge service
- Graceful error handling with actionable messages
- Support for custom entrypoint override

#### `entrypoint-detector.ts` - Entrypoint Detection
- Scans Python files for FastAPI app instances
- Tries common patterns: `main:app`, `app:app`, `api:app`, `src.main:app`, etc.
- Parses code to detect `FastAPI()` instantiation
- Extracts app variable name from code
- Returns confidence level (high/medium/low)

**Detection Strategy:**
1. Custom entrypoint (if provided) → HIGH confidence
2. Scan candidate files for `FastAPI()` → HIGH confidence
3. Fall back to common patterns → MEDIUM confidence

### 2. Error Classification System (`services/control-plane/src/lib/errors/`)

#### `taxonomy.ts` - Error Classes
Defines 8 error classes with suggested fixes:
- `import_error` - Can't import user code
- `no_fastapi_app` - No FastAPI app found
- `schema_extraction_failed` - OpenAPI extraction failed
- `timeout` - Import took >30s
- `dependency_missing` - Missing required package
- `syntax_error` - Python syntax errors
- `circular_import` - Circular import detected
- `entrypoint_not_found` - Couldn't find FastAPI app

Each error includes:
- User-friendly error message
- Actionable suggested fix
- Technical details for debugging

#### `classifier.ts` - Pattern Matching
- Parses Python tracebacks
- Maps error patterns to error classes
- Extracts missing package names
- Extracts syntax error locations
- Sanitizes technical details (removes sensitive paths)

### 3. Python Bridge Service (`services/control-plane/src/lib/openapi/bridge.py`)

FastAPI service that:
- **Endpoint**: `POST /extract-openapi`
- **Input**: `{zip_path, entrypoint, timeout_seconds}`
- **Process**:
  1. Imports user FastAPI app with 30s timeout
  2. Calls `app.openapi()` to get schema
  3. Extracts endpoint metadata
  4. Detects GPU requirements from descriptions
  5. Classifies errors if import fails
- **Output**: OpenAPI JSON + endpoint list + error info

**Security Features:**
- Timeout protection using `signal.SIGALRM`
- Isolated import (adds project path to `sys.path`)
- Type validation (ensures it's a FastAPI instance)
- Error classification for user-friendly messages

**GPU Detection:**
Checks endpoint descriptions for keywords:
- `gpu`, `inference`, `predict`, `model`, `neural`, `ml`, `torch`, `tensorflow`

### 4. Test Suite (`services/control-plane/tests/openapi/`)

#### `extractor.test.ts` - Comprehensive Tests
- **Entrypoint Detection Tests**
  - Auto-detection from Python files
  - Validation of entrypoint formats
  - Parsing of entrypoint strings
  - Custom entrypoint override

- **Error Classification Tests**
  - Import errors
  - Timeout errors
  - Syntax errors
  - Missing app errors
  - Circular import errors
  - Package extraction
  - Location extraction

- **Integration Tests** (require bridge service)
  - Successful extraction
  - Error handling
  - Custom entrypoint
  - Network error handling

#### Test Fixtures (`tests/openapi/fixtures/`)
- `simple_app.py` - Basic FastAPI app (happy path)
- `no_app.py` - No FastAPI instance exported
- `broken_import.py` - Import error
- `custom_entrypoint.py` - Non-standard variable name
- `syntax_error.py` - Python syntax error
- `slow_import.py` - Exceeds 30s timeout

## API Contracts

### ExtractOpenAPIRequest
```typescript
{
  project_id: string;
  version_id: string;
  zip_path: string;      // Path to extracted ZIP
  entrypoint?: string;   // Optional, e.g., "main:app"
}
```

### ExtractOpenAPIResponse
```typescript
{
  openapi_schema: unknown;       // OpenAPI 3.1 JSON
  endpoints: EndpointMeta[];
  entrypoint: string;            // Used entrypoint
  entrypoint_detection?: EntrypointResult;
  error?: ClassifiedError;
}
```

### EndpointMeta
```typescript
{
  endpoint_id: string;     // "POST_/extract_company"
  method: string;          // "POST"
  path: string;            // "/extract_company"
  summary?: string;
  description?: string;
  requires_gpu?: boolean;  // Auto-detected
}
```

### ClassifiedError
```typescript
{
  error_class: ErrorClass;
  error_message: string;
  suggested_fix: string;
  technical_details?: string;
}
```

## Files Created

### TypeScript (Control Plane)
```
services/control-plane/src/lib/
├── openapi/
│   ├── extractor.ts          # Main OpenAPI extractor
│   ├── entrypoint-detector.ts # Entrypoint detection logic
│   ├── bridge.py             # Python bridge service
│   ├── index.ts              # Public API exports
│   ├── example.ts            # Usage example
│   ├── requirements.txt      # Python dependencies
│   └── README.md             # Documentation
└── errors/
    ├── taxonomy.ts           # Error classes & messages
    ├── classifier.ts         # Error pattern matching
    └── index.ts              # Public API exports
```

### Tests
```
services/control-plane/tests/openapi/
├── extractor.test.ts         # Vitest test suite
└── fixtures/
    ├── simple_app.py         # Basic FastAPI app
    ├── no_app.py             # No FastAPI instance
    ├── broken_import.py      # Import error
    ├── custom_entrypoint.py  # Custom variable name
    ├── syntax_error.py       # Syntax error
    └── slow_import.py        # Timeout test
```

## Usage

### 1. Start Python Bridge Service

```bash
cd services/control-plane/src/lib/openapi
python bridge.py
# Runs on http://localhost:8001
```

### 2. Use TypeScript Extractor

```typescript
import { createExtractor } from '@/lib/openapi';

const extractor = createExtractor();

const response = await extractor.extract({
  project_id: 'abc-123',
  version_id: 'def-456',
  zip_path: '/path/to/extracted/project'
});

if (response.error) {
  console.error(response.error.error_message);
  console.log('Fix:', response.error.suggested_fix);
} else {
  console.log('Endpoints:', response.endpoints);
}
```

### 3. Run Tests

```bash
# Without bridge service (unit tests only)
npm run test services/control-plane/tests/openapi/

# With bridge service (integration tests)
# Terminal 1:
python services/control-plane/src/lib/openapi/bridge.py

# Terminal 2:
npm run test services/control-plane/tests/openapi/
```

### 4. Run Example

```bash
# Start bridge service first
python services/control-plane/src/lib/openapi/bridge.py

# Run example
npx tsx services/control-plane/src/lib/openapi/example.ts [path-to-project]
```

## Error Handling Examples

### Import Error
```
Error: import_error
Message: Could not import your FastAPI application
Fix: Check that all imports in your code are valid and dependencies are in requirements.txt
Details: ModuleNotFoundError: No module named 'pandas'
```

### No FastAPI App
```
Error: no_fastapi_app
Message: No FastAPI app instance found in your code
Fix: Create a FastAPI instance: app = FastAPI(). Common patterns: main:app, app:app, api:app
Details: Module 'main' has no attribute 'app'
```

### Timeout
```
Error: timeout
Message: Import timeout - application startup took too long
Fix: Import took too long (>30s). Move heavy initialization to lazy-loaded functions or endpoints
Details: Import exceeded 30s timeout
```

## Success Criteria

✅ **All criteria met:**

- [x] Can extract OpenAPI from real FastAPI app
- [x] Detects entrypoint automatically (7 common patterns)
- [x] Classifies errors with helpful messages (8 error classes)
- [x] Handles import timeout (30s configurable)
- [x] Returns proper endpoint list with metadata
- [x] All tests pass with real fixtures (6 fixtures)
- [x] No placeholder code - all implementations complete

## Dependencies

### Python Bridge
```
fastapi==0.104.1
uvicorn[standard]==0.24.0
pydantic==2.5.0
```

### TypeScript (Node.js built-ins)
- `fs/promises` - File system operations
- `path` - Path manipulation
- `fetch` - HTTP requests (Node 18+)

## Integration Points

### For Agent 5 (Run Page)
This system provides the endpoint schemas needed for form generation:

```typescript
// Agent 5 will use these endpoints
const { endpoints } = await extractor.extract(request);

endpoints.forEach(endpoint => {
  // Generate form from endpoint.method, endpoint.path
  // Use openapi_schema to get parameter schemas
  // Use requires_gpu to show GPU toggle
});
```

### For Agent 2 (Modal Runtime)
The classified errors help provide better error messages in the runner:

```typescript
if (response.error) {
  return {
    error_class: response.error.error_class,
    error_message: response.error.error_message,
    suggested_fix: response.error.suggested_fix
  };
}
```

## Environment Variables

```bash
# Python bridge URL (default: http://localhost:8001)
OPENAPI_BRIDGE_URL=http://localhost:8001
```

## Next Steps

1. **Agent 5**: Use extracted endpoints to generate Run Page forms
2. **Agent 2**: Integrate error taxonomy into Modal runtime
3. **Caching**: Add schema caching by version hash
4. **Validation**: Add OpenAPI schema validation
5. **Performance**: Consider parallel extraction for multiple projects

## Notes

- Python bridge runs as separate FastAPI service (not in Modal yet)
- Timeout protection prevents hanging on heavy imports
- GPU detection is keyword-based (simple heuristic for v0)
- All error messages include actionable suggested fixes
- Entrypoint detection scans actual code (not just file names)
- Tests use real FastAPI apps (not mocks)

## Documentation

See `services/control-plane/src/lib/openapi/README.md` for:
- Detailed architecture
- API reference
- Error classification guide
- Troubleshooting
- Future enhancements
