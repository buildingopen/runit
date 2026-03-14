# @buildingopen/shared

Shared types, contracts, and schemas used across RunIt packages.

## Exports

- `@buildingopen/shared` — Main exports
- `@buildingopen/shared/contracts` — API request/response contracts
- `@buildingopen/shared/types` — TypeScript type definitions
- `@buildingopen/shared/schemas` — Zod validation schemas

## Usage

```typescript
import { ProjectContract, RunContract } from '@buildingopen/shared/contracts';
import { Project, Run, Endpoint } from '@buildingopen/shared/types';
import { projectSchema, runSchema } from '@buildingopen/shared/schemas';
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
