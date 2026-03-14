# @buildingopen/openapi-form

React hooks and utilities for generating dynamic forms from OpenAPI schemas.

## Features

- Parse OpenAPI 3.x schemas
- Generate form state from schema definitions
- Type-safe form handling with Zod validation
- Example value generation for API testing

## Installation

```bash
npm install @buildingopen/openapi-form
```

## Usage

```tsx
import { useSchemaAnalysis, useFormState } from '@buildingopen/openapi-form';

function EndpointForm({ schema }) {
  const analysis = useSchemaAnalysis(schema);
  const { values, errors, setValue } = useFormState(analysis);

  return (
    <form>
      {analysis.fields.map(field => (
        <input
          key={field.name}
          value={values[field.name]}
          onChange={e => setValue(field.name, e.target.value)}
        />
      ))}
    </form>
  );
}
```

## Development

```bash
npm run dev    # Watch mode
npm run build  # Build package
npm run test   # Run tests
```
