# Web

Next.js frontend for RunIt.

## Features

- Project dashboard
- ZIP upload interface
- Run page with dynamic forms
- Run history and logs
- Secrets management UI
- Share link generation

## Tech Stack

- [Next.js 15](https://nextjs.org) — React framework
- [Tailwind CSS 4](https://tailwindcss.com) — Styling
- [TanStack Query](https://tanstack.com/query) — Data fetching
- [Supabase](https://supabase.com) — Authentication

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

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
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
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
