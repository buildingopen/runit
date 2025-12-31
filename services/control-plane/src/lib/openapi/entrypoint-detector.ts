/**
 * Entrypoint Detection Logic
 *
 * ABOUTME: Scans Python files to detect FastAPI app entrypoint
 * ABOUTME: Tries common patterns and supports custom entrypoint override
 */

import { readFile, readdir, stat } from 'fs/promises';
import { join, extname } from 'path';

/**
 * Common entrypoint patterns (in order of precedence)
 */
export const COMMON_ENTRYPOINTS = [
  'main:app',
  'app:app',
  'api:app',
  'src.main:app',
  'api.main:app',
  'server:app',
  'app.main:app'
];

/**
 * File patterns to search for FastAPI app
 */
const APP_FILE_PATTERNS = [
  'main.py',
  'app.py',
  'api.py',
  'server.py',
  'app/main.py',
  'src/main.py',
  'api/main.py'
];

/**
 * Entrypoint detection result
 */
export interface EntrypointResult {
  entrypoint: string;
  confidence: 'high' | 'medium' | 'low';
  detectionMethod: 'custom' | 'pattern' | 'scan';
  candidateFiles?: string[];
}

/**
 * Detect FastAPI app entrypoint from a project bundle
 */
export async function detectEntrypoint(
  projectPath: string,
  customEntrypoint?: string
): Promise<EntrypointResult> {
  // 1. Custom entrypoint (highest priority)
  if (customEntrypoint) {
    return {
      entrypoint: customEntrypoint,
      confidence: 'high',
      detectionMethod: 'custom'
    };
  }

  // 2. Try common file patterns
  const candidateFiles = await findCandidateFiles(projectPath);

  if (candidateFiles.length === 0) {
    // No Python files found - try default
    return {
      entrypoint: 'main:app',
      confidence: 'low',
      detectionMethod: 'pattern',
      candidateFiles: []
    };
  }

  // 3. Scan files for FastAPI instantiation
  const detectedEntrypoint = await scanForFastAPIApp(
    projectPath,
    candidateFiles
  );

  if (detectedEntrypoint) {
    return {
      entrypoint: detectedEntrypoint,
      confidence: 'high',
      detectionMethod: 'scan',
      candidateFiles
    };
  }

  // 4. Fall back to most common pattern
  return {
    entrypoint: 'main:app',
    confidence: 'medium',
    detectionMethod: 'pattern',
    candidateFiles
  };
}

/**
 * Find candidate Python files in project
 */
async function findCandidateFiles(projectPath: string): Promise<string[]> {
  const candidates: string[] = [];

  // Try specific file patterns first
  for (const pattern of APP_FILE_PATTERNS) {
    const filePath = join(projectPath, pattern);
    try {
      const stats = await stat(filePath);
      if (stats.isFile()) {
        candidates.push(pattern);
      }
    } catch {
      // File doesn't exist, continue
    }
  }

  // If no specific files found, scan root directory
  if (candidates.length === 0) {
    try {
      const files = await readdir(projectPath);
      for (const file of files) {
        if (extname(file) === '.py') {
          candidates.push(file);
        }
      }
    } catch (error) {
      console.error('Error reading project directory:', error);
    }
  }

  return candidates;
}

/**
 * Scan Python files for FastAPI app instantiation
 */
async function scanForFastAPIApp(
  projectPath: string,
  candidates: string[]
): Promise<string | null> {
  for (const candidate of candidates) {
    const filePath = join(projectPath, candidate);

    try {
      const content = await readFile(filePath, 'utf-8');

      // Look for FastAPI instantiation patterns
      if (hasFastAPIApp(content)) {
        // Extract module name from file path
        const moduleName = candidate
          .replace(/\.py$/, '')
          .replace(/\//g, '.');

        // Try to find variable name
        const appVarName = extractAppVariableName(content);

        return `${moduleName}:${appVarName}`;
      }
    } catch (error) {
      // Can't read file, skip
      console.warn(`Could not read ${candidate}:`, error);
    }
  }

  return null;
}

/**
 * Check if file content contains FastAPI instantiation
 */
function hasFastAPIApp(content: string): boolean {
  const patterns = [
    /from\s+fastapi\s+import\s+FastAPI/,
    /import\s+fastapi/,
    /FastAPI\s*\(/,
    /=\s*FastAPI\s*\(/
  ];

  return patterns.some(pattern => pattern.test(content));
}

/**
 * Extract app variable name from Python code
 */
function extractAppVariableName(content: string): string {
  // Look for common patterns:
  // app = FastAPI()
  // application = FastAPI()
  // api = FastAPI()

  const patterns = [
    /(\w+)\s*=\s*FastAPI\s*\(/,
    /(\w+)\s*:\s*FastAPI\s*=\s*FastAPI\s*\(/
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      return match[1];
    }
  }

  // Default to 'app'
  return 'app';
}

/**
 * Validate entrypoint format
 */
export function validateEntrypoint(entrypoint: string): boolean {
  // Format: module:variable or module.submodule:variable
  const pattern = /^[a-zA-Z_][a-zA-Z0-9_.]*:[a-zA-Z_][a-zA-Z0-9_]*$/;
  return pattern.test(entrypoint);
}

/**
 * Parse entrypoint string into module and variable
 */
export function parseEntrypoint(entrypoint: string): {
  module: string;
  variable: string;
} {
  const [module, variable] = entrypoint.split(':');
  return { module, variable };
}
