# @runtime-ai/shared

Shared types, contracts, and schemas used across Runtime AI packages.

## Exports

- `@runtime-ai/shared` — Main exports
- `@runtime-ai/shared/contracts` — API request/response contracts
- `@runtime-ai/shared/types` — TypeScript type definitions
- `@runtime-ai/shared/schemas` — Zod validation schemas

## Usage

```typescript
import { ProjectContract, RunContract } from '@runtime-ai/shared/contracts';
import { Project, Run, Endpoint } from '@runtime-ai/shared/types';
import { projectSchema, runSchema } from '@runtime-ai/shared/schemas';
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
