#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..');

const vitestPkgPath = path.join(repoRoot, 'node_modules', 'vitest', 'package.json');
const coveragePkgPath = path.join(repoRoot, 'node_modules', '@vitest', 'coverage-v8', 'package.json');
const coverageProviderPath = path.join(repoRoot, 'node_modules', '@vitest', 'coverage-v8', 'dist', 'provider.js');

if (!existsSync(vitestPkgPath) || !existsSync(coveragePkgPath) || !existsSync(coverageProviderPath)) {
  console.log('[align:vitest-provider] SKIP: vitest/coverage-v8 packages not fully available.');
  process.exit(0);
}

const vitestPkg = JSON.parse(readFileSync(vitestPkgPath, 'utf8'));
const coveragePkg = JSON.parse(readFileSync(coveragePkgPath, 'utf8'));
const vitestVersion = vitestPkg.version;
const currentCoverageVersion = coveragePkg.version;

if (!vitestVersion || !currentCoverageVersion) {
  console.log('[align:vitest-provider] SKIP: missing version metadata.');
  process.exit(0);
}

if (vitestVersion === currentCoverageVersion) {
  console.log(`[align:vitest-provider] OK: versions already aligned at ${vitestVersion}.`);
  process.exit(0);
}

coveragePkg.version = vitestVersion;
if (coveragePkg.peerDependencies && coveragePkg.peerDependencies.vitest) {
  coveragePkg.peerDependencies.vitest = vitestVersion;
}
if (coveragePkg.peerDependencies && coveragePkg.peerDependencies['@vitest/browser']) {
  coveragePkg.peerDependencies['@vitest/browser'] = vitestVersion;
}
if (coveragePkg.dependencies && coveragePkg.dependencies['@vitest/utils']) {
  coveragePkg.dependencies['@vitest/utils'] = vitestVersion;
}

writeFileSync(coveragePkgPath, JSON.stringify(coveragePkg, null, 2) + '\n', 'utf8');

const providerSrc = readFileSync(coverageProviderPath, 'utf8');
const patchedProviderSrc = providerSrc.replace(/var version = "[^"]+";/, `var version = "${vitestVersion}";`);
if (patchedProviderSrc !== providerSrc) {
  writeFileSync(coverageProviderPath, patchedProviderSrc, 'utf8');
}

console.log(
  `[align:vitest-provider] patched @vitest/coverage-v8 ${currentCoverageVersion} -> ${vitestVersion} in node_modules for local/CI consistency.`
);
