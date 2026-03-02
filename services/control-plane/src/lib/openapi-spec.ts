/**
 * OpenAPI 3.0 Specification for Control Plane API
 *
 * Loaded from docs/openapi.yaml at startup.
 * The YAML file is the single source of truth.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Resolve path to docs/openapi.yaml from either src/ or dist/
function findSpecPath(): string {
  const candidates = [
    join(__dirname, '..', '..', 'docs', 'openapi.yaml'),       // from src/lib/
    join(__dirname, '..', '..', '..', 'docs', 'openapi.yaml'), // from dist/lib/
  ];
  for (const candidate of candidates) {
    try {
      readFileSync(candidate, 'utf-8');
      return candidate;
    } catch {
      // try next
    }
  }
  throw new Error(`OpenAPI spec not found. Tried: ${candidates.join(', ')}`);
}

const specPath = findSpecPath();
const specYaml = readFileSync(specPath, 'utf-8');
export const openAPISpec = yaml.load(specYaml) as Record<string, unknown>;
