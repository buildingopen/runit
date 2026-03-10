# @runit/shared

Shared types, contracts, and schemas used across RunIt packages.

## Exports

- `@runit/shared` — Main exports
- `@runit/shared/contracts` — API request/response contracts
- `@runit/shared/types` — TypeScript type definitions
- `@runit/shared/schemas` — Zod validation schemas

## Usage

```typescript
import { ProjectContract, RunContract } from '@runit/shared/contracts';
import { Project, Run, Endpoint } from '@runit/shared/types';
import { projectSchema, runSchema } from '@runit/shared/schemas';
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
