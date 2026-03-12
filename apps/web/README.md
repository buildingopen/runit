# Web

Next.js frontend for RunIt.

## Features

- Paste code and go live
- Auto-generated forms from type hints
- Run history and logs
- Secrets management UI
- Share link generation
- Templates gallery

## Tech Stack

- [Next.js 15](https://nextjs.org) - React framework
- [Tailwind CSS 4](https://tailwindcss.com) - Styling
- [TanStack Query](https://tanstack.com/query) - Data fetching

## Development

```bash
# Install dependencies
npm install

# Start development server
NEXT_PUBLIC_API_URL=http://localhost:3001 npm run dev -- -p 3000

# Build for production
npm run build

# Run unit tests
npm run test

# Run E2E tests
npm run test:e2e
```

## Environment Variables

```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Structure

```
app/
├── page.tsx              # Home / dashboard
├── new/                  # New project upload
├── p/[project]/          # Project pages
│   ├── page.tsx          # Project overview
│   ├── e/[endpoint]/     # Endpoint run page
│   └── settings/         # Project settings

components/
├── run-page/             # Run page components
├── upload/               # ZIP upload components
└── ui/                   # shadcn/ui primitives
```

## E2E Testing

```bash
# Install browsers
npx playwright install

# Run tests
npm run test:e2e

# Run with UI
npm run test:e2e:ui
```
