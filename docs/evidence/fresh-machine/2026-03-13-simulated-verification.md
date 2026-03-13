=== RunIt Fresh-Machine Verification ===
Date: 2026-03-13
Simulated: true

1) Quick Start container (web 3000, API 3001)
   Docker available. Run: docker run -p 3000:3000 -p 3001:3001 -e NEXT_PUBLIC_API_URL=http://localhost:3001 -e MASTER_ENCRYPTION_KEY=$(openssl rand -base64 32) ghcr.io/buildingopen/runit
   [ ] Manual: verify web on 3000, API on 3001

2) docker-compose up --build
   Run: docker-compose up --build -d && curl -sf http://localhost:3001/health
   [ ] Manual: verify /health responds on 3001

3) npm run verify

> runit@0.1.0 verify
> npm run lint && npm test && npm run build && npm run verify:ts-coverage && npm run verify:runner && npm run verify:sdk


> runit@0.1.0 lint
> turbo run lint

   FAIL or SKIP (check node/native deps)

4) Golden-path E2E
   Run: npx playwright test tests/e2e/golden-path.spec.ts
   [ ] Manual: requires control-plane and web running

5) README commands match runtime behavior
   [ ] Manual: verify README.md commands work

=== Verification complete. Record results in docs/PRR_SCORECARD.md ===
