#!/usr/bin/env node

import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..');
const coveragePkg = path.join(repoRoot, 'node_modules', '@vitest', 'coverage-v8');
const strictMissingProvider = process.env.REQUIRE_TS_COVERAGE === 'true';

function run(cmd, args) {
  const result = spawnSync(cmd, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    env: process.env,
  });
  return result.status ?? 1;
}

if (!existsSync(coveragePkg)) {
  const msg = '[verify:ts-coverage] @vitest/coverage-v8 not installed.';
  console.log(`${strictMissingProvider ? 'FAIL' : 'SKIP'}: ${msg}`);
  console.log('[verify:ts-coverage] Install with: npm install -D @vitest/coverage-v8');
  process.exit(strictMissingProvider ? 1 : 0);
}

const baseArgs = [
  '--coverage.enabled',
  'true',
  '--coverage.provider=v8',
  '--coverage.reporter=text',
];

const commands = [
  {
    workspace: 'packages/shared',
    thresholds: { lines: 95, functions: 95, statements: 95, branches: 95 },
  },
  {
    workspace: 'packages/ui',
    thresholds: { lines: 95, functions: 95, statements: 95, branches: 95 },
  },
  {
    workspace: 'packages/openapi-form',
    thresholds: { lines: 82, functions: 80, statements: 80, branches: 70 },
  },
  {
    workspace: 'services/control-plane',
    // Keep the gate slightly below the measured baseline until more route tests
    // land, so CI catches regressions instead of failing every PR by default.
    thresholds: { lines: 72, functions: 76, statements: 71, branches: 63 },
  },
  {
    workspace: 'apps/web',
    thresholds: { lines: 94, functions: 97, statements: 91, branches: 89 },
  },
];

for (const { workspace, thresholds } of commands) {
  const args = [
    'run',
    'test',
    '--workspace=' + workspace,
    '--',
    ...baseArgs,
    `--coverage.thresholds.lines=${thresholds.lines}`,
    `--coverage.thresholds.functions=${thresholds.functions}`,
    `--coverage.thresholds.statements=${thresholds.statements}`,
    `--coverage.thresholds.branches=${thresholds.branches}`,
  ];

  console.log(
    `[verify:ts-coverage] ${workspace} thresholds: lines>=${thresholds.lines}, functions>=${thresholds.functions}, statements>=${thresholds.statements}, branches>=${thresholds.branches}`,
  );

  const code = run('npm', args);
  if (code !== 0) {
    process.exit(code);
  }
}

console.log('[verify:ts-coverage] PASS: coverage thresholds enforced for TypeScript workspaces.');
