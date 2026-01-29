# @execution-layer/shared

Shared types, contracts, and schemas used across Runtime AI packages.

## Exports

- `@execution-layer/shared` — Main exports
- `@execution-layer/shared/contracts` — API request/response contracts
- `@execution-layer/shared/types` — TypeScript type definitions
- `@execution-layer/shared/schemas` — Zod validation schemas

## Usage

```typescript
import { ProjectContract, RunContract } from '@execution-layer/shared/contracts';
import { Project, Run, Endpoint } from '@execution-layer/shared/types';
import { projectSchema, runSchema } from '@execution-layer/shared/schemas';
```

## Development

```bash
npm run dev    # Watch mode
npm run build  # Build package
npm run test   # Run tests
```

## Guidelines

- Keep this package dependency-free (except Zod)
- All types should be exported from the appropriate subpath
- Changes here affect all consuming packages
