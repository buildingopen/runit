# @runtime-ai/ui

React component library for Runtime AI.

## Features

- Reusable UI components
- Built with class-variance-authority for variant styling
- TypeScript support
- Tailwind CSS compatible

## Installation

```bash
npm install @runtime-ai/ui
```

## Usage

```tsx
import { Button, Card, Input } from '@runtime-ai/ui';

function MyComponent() {
  return (
    <Card>
      <Input placeholder="Enter value" />
      <Button variant="primary">Submit</Button>
    </Card>
  );
}
```

## Development

```bash
npm run dev    # Watch mode
npm run build  # Build package
npm run test   # Run tests
```

## Guidelines

- Components should be presentational (no business logic)
- Use CVA for variant patterns
- Export all components from the main index
