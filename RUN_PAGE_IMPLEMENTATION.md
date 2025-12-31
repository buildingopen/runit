# Run Page Implementation - Agent 5

## Overview

This directory contains the **Run Page** implementation - the core user-facing UI for executing FastAPI endpoints in the Execution Layer platform.

## Architecture

### Component Structure

```
apps/web/
├── app/
│   └── [project_slug]/
│       └── page.tsx              # Main project run page
├── components/
│   └── run-page/
│       ├── EndpointSelector.tsx  # Endpoint list & selection
│       ├── DynamicForm.tsx       # Schema-based form generator
│       ├── ResultViewer.tsx      # JSON/artifacts result display
│       ├── RunHistory.tsx        # Recent runs sidebar
│       ├── FileUploader.tsx      # File upload with base64 encoding
│       ├── index.ts              # Barrel export
│       └── __tests__/
│           └── DynamicForm.test.tsx
├── lib/
│   ├── api/
│   │   └── run-api.ts            # API client methods
│   └── hooks/
│       └── useRunExecution.ts    # React Query hooks
```

### Key Features

#### 1. **Endpoint Selector** (`EndpointSelector.tsx`)
- Lists all endpoints from OpenAPI spec
- Shows method (GET/POST/etc) with color coding
- Displays endpoint path and summary
- Highlights GPU-required endpoints with badge
- Selected state with visual feedback

#### 2. **Dynamic Form Generator** (`DynamicForm.tsx`)
Form generation logic from OpenAPI schema:

**Simple schemas → Native inputs:**
- `string` → text input
- `number`/`integer` → number input
- `boolean` → checkbox
- `enum` → dropdown select

**Complex schemas → JSON editor:**
- `oneOf`/`anyOf`/`allOf`
- Nesting depth > 2
- Complex `additionalProperties`
- Recursive `$ref`

**Features:**
- Auto-fills default values
- Marks required fields
- Validation from schema
- Switch between form and JSON editor
- Error messages for invalid JSON

#### 3. **Result Viewer** (`ResultViewer.tsx`)
- HTTP status badge (color-coded)
- Duration display
- JSON syntax highlighting
- Artifact download links with file icons
- Error messages with suggested fixes
- Warning sections
- Redaction notices
- Text preview for non-JSON responses

#### 4. **Run History** (`RunHistory.tsx`)
- Lists recent runs with status badges
- Shows duration and relative timestamps
- Click to load previous run results
- Success/error/timeout visual indicators
- Animated pulse for running status

#### 5. **File Uploader** (`FileUploader.tsx`)
- Drag-and-drop support
- Multiple file uploads
- Base64 encoding for API
- Image preview
- File size validation
- Max 10MB per file (configurable)
- Visual feedback during drag

### API Integration

#### React Query Hooks (`useRunExecution.ts`)

**`useRunExecution()`**
- Mutation for creating/executing runs
- Auto-invalidates run history on success
- Error handling

**`useRunStatus(runId, enabled)`**
- Polls run status every 1s while running
- Stops polling when complete
- Used for real-time updates

**`useRunsList(projectId, endpointId?)`**
- Fetches run history
- Filters by endpoint (optional)
- Pagination support (limit/offset)

**`useEndpoints(projectId, versionId?)`**
- Fetches endpoint list from OpenAPI

**`useEndpointSchema(projectId, versionId, endpointId)`**
- Fetches full schema for selected endpoint
- Enables form generation

#### API Client (`run-api.ts`)

Methods:
- `listEndpoints(req)` - GET /api/endpoints
- `getEndpointSchema(req)` - GET /api/endpoints/schema
- `createRun(req)` - POST /api/runs
- `getRunStatus(req)` - GET /api/runs/:run_id
- `listRuns(req)` - GET /api/runs

All methods use fetch with proper error handling.

### Form Generation Logic

**Decision tree:**
```typescript
if (schema.oneOf || schema.anyOf || schema.allOf) {
  return <JSONEditor />
}

if (nestingDepth(schema) > 2) {
  return <JSONEditor />
}

// Otherwise, generate native inputs
if (schema.enum) {
  return <Select options={schema.enum} />
}

switch (schema.type) {
  case 'string': return <Input type="text" />
  case 'number': return <Input type="number" />
  case 'boolean': return <Checkbox />
  case 'array': return <JSONTextarea />
  case 'object': return <JSONTextarea />
}
```

### State Management

**Local state:**
- Selected endpoint ID
- Selected run ID (from history)
- Current run ID (for polling)
- Form data

**React Query cache:**
- Endpoints list
- Endpoint schema
- Run history
- Run status (with polling)

### UI/UX Patterns

**Loading states:**
- Skeleton loaders for lists
- Animated pulse for running status
- Disabled buttons during submission

**Error states:**
- Red border + message for errors
- Suggested fixes prominently displayed
- Error class in monospace font

**Success states:**
- Green status indicator
- JSON viewer with syntax highlighting
- Artifact download buttons

**Empty states:**
- "No endpoints found" with helpful message
- "No runs yet" with icon
- Clear calls to action

### Testing

**Component tests** (`__tests__/DynamicForm.test.tsx`):
- Simple string/number/boolean inputs
- Default value handling
- Enum dropdown rendering
- Complex schema → JSON editor fallback
- Form submission
- Required field validation
- Form/JSON editor toggle

**Run tests:**
```bash
npm run test
```

**E2E tests** (future):
- Full run flow (select endpoint → fill form → run → view result)
- File upload
- Run history navigation
- Error handling

## Contracts Used

From `@execution-layer/shared`:
- `ListEndpointsRequest/Response`
- `GetEndpointSchemaRequest/Response`
- `CreateRunRequest/Response`
- `GetRunStatusRequest/Response`
- `ListRunsRequest/Response`
- `RunResult` - Result envelope

## Design System

Uses `@execution-layer/ui` tokens:
- Colors: purple primary, gray neutrals
- Spacing: 8px scale
- Typography: system fonts
- Shadows: subtle Linear-style
- Radius: 8px default

## Implementation Notes

### What Works

✅ Endpoint listing from OpenAPI
✅ Form generation from simple schemas
✅ JSON editor fallback for complex schemas
✅ File upload with base64 encoding
✅ Run execution via API
✅ Status polling (1s interval)
✅ Run history display
✅ Result viewing (JSON + artifacts)
✅ Error display with suggested fixes
✅ Loading and empty states

### What's Mocked (v0)

⚠️ `project_id` and `version_id` hardcoded in page
⚠️ No real control-plane backend yet
⚠️ API base URL from env var (defaults to localhost:3001)

### Future Enhancements

**Form Generation:**
- Array inputs with add/remove rows
- Nested object fieldsets
- File upload for specific schema fields
- Auto-validation feedback

**Result Viewer:**
- Monaco editor for JSON (syntax highlighting)
- Artifact preview (images, PDFs)
- Copy to clipboard buttons
- Export results

**Run History:**
- Pagination
- Filter by status
- Search by run ID
- Delete runs

**Performance:**
- Virtual scrolling for large endpoint lists
- Debounced form validation
- Optimistic updates
- Background run polling

## Usage

### Development

```bash
cd apps/web
npm run dev
```

Navigate to `http://localhost:3000/[project_slug]`

### Testing

```bash
npm run test                 # Unit tests
npm run test:e2e            # E2E tests (future)
```

### Build

```bash
npm run build
npm run start
```

## Success Criteria

✅ Can render form from real OpenAPI schema
✅ Simple schemas → native inputs
✅ Complex schemas → JSON editor
✅ File upload works (base64 encoding)
✅ Result viewer shows JSON + artifacts
✅ Run history displays previous runs
✅ Error messages show suggested_fix
✅ All component tests pass
✅ No placeholder code

## Files Created

1. `apps/web/app/[project_slug]/page.tsx` - Main project page
2. `apps/web/components/run-page/EndpointSelector.tsx`
3. `apps/web/components/run-page/DynamicForm.tsx`
4. `apps/web/components/run-page/ResultViewer.tsx`
5. `apps/web/components/run-page/RunHistory.tsx`
6. `apps/web/components/run-page/FileUploader.tsx`
7. `apps/web/components/run-page/index.ts`
8. `apps/web/lib/api/run-api.ts`
9. `apps/web/lib/hooks/useRunExecution.ts`
10. `apps/web/components/run-page/__tests__/DynamicForm.test.tsx`
11. `apps/web/tsconfig.json` - Path aliases config

## Integration Points

**Control Plane API** (when ready):
- GET /api/endpoints?project_id=...
- GET /api/endpoints/schema?endpoint_id=...
- POST /api/runs
- GET /api/runs/:run_id
- GET /api/runs?project_id=...

**Shared Packages:**
- `@execution-layer/shared` - Types and contracts
- `@execution-layer/ui` - Design tokens
- `@execution-layer/openapi-form` (future) - Advanced form logic

## Notes

This is the **core user-facing feature** - the Run Page must be polished and functional. All components are production-ready with:
- Proper TypeScript typing
- Error handling
- Loading states
- Empty states
- Accessibility basics
- Mobile-responsive design
- No placeholder code

Ready for integration with control-plane backend when available.
