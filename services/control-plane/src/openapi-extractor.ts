/**
 * OpenAPI Extractor - Extract OpenAPI spec from FastAPI code
 *
 * This is a simplified version that uses Python to extract the OpenAPI spec.
 * Agent 3 has a more sophisticated implementation in TypeScript.
 */

import { spawn } from 'child_process';
import { writeFileSync, unlinkSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';

interface ExtractedOpenAPI {
  openapi: any;
  endpoints: Array<{
    id: string;
    method: string;
    path: string;
    summary?: string;
    description?: string;
    requires_gpu?: boolean;
  }>;
  entrypoint: string;  // e.g., "api:app" - detected entrypoint
}

/**
 * Extract OpenAPI spec from ZIP bundle
 */
export async function extractOpenAPIFromZip(zipBase64: string): Promise<ExtractedOpenAPI> {
  const workDir = join(tmpdir(), `openapi-extract-${randomUUID()}`);
  mkdirSync(workDir, { recursive: true });

  // Create Python script to extract OpenAPI
  const extractScript = `
import base64
import io
import json
import sys
import os
import zipfile
from pathlib import Path

# Decode and extract ZIP
zip_data = base64.b64decode('''${zipBase64}''')
with zipfile.ZipFile(io.BytesIO(zip_data)) as zf:
    zf.extractall('${workDir}')

# Find the app directory (might be nested in a folder)
app_dir = '${workDir}'
items = [f for f in os.listdir(app_dir) if not f.startswith('.') and f != '__pycache__']
if len(items) == 1 and os.path.isdir(os.path.join(app_dir, items[0])):
    app_dir = os.path.join(app_dir, items[0])

# Add to Python path
sys.path.insert(0, app_dir)

# Change to app dir for relative imports
os.chdir(app_dir)

# Import the FastAPI app
app = None
detected_entrypoint = None
for module_name, var_name in [('main', 'app'), ('app', 'app'), ('api', 'app'), ('main', 'application'), ('server', 'app')]:
    try:
        module = __import__(module_name)
        if hasattr(module, var_name):
            app = getattr(module, var_name)
            detected_entrypoint = f"{module_name}:{var_name}"
            break
    except ImportError:
        continue

if app is None:
    print(json.dumps({"error": "Could not find FastAPI app (tried main:app, app:app, api:app, server:app)"}))
    sys.exit(1)

# Extract OpenAPI spec
try:
    openapi_spec = app.openapi()
    # Add entrypoint to the response
    openapi_spec["x_entrypoint"] = detected_entrypoint
    print(json.dumps(openapi_spec))
except Exception as e:
    print(json.dumps({"error": f"Failed to extract OpenAPI: {str(e)}"}))
    sys.exit(1)
`;

  const scriptPath = join(workDir, 'extract.py');
  writeFileSync(scriptPath, extractScript);

  try {
    // Execute Python script
    const result = await executePythonScript(scriptPath, 30);

    // Parse OpenAPI spec
    const openapi = JSON.parse(result);

    if (openapi.error) {
      throw new Error(openapi.error);
    }

    // Extract endpoints from paths
    const endpoints: Array<{
      id: string;
      method: string;
      path: string;
      summary?: string;
      description?: string;
    }> = [];

    for (const [path, pathItem] of Object.entries(openapi.paths || {})) {
      for (const [method, operation] of Object.entries(pathItem as any)) {
        if (['get', 'post', 'put', 'delete', 'patch'].includes(method)) {
          endpoints.push({
            id: `${method}-${path}`.replace(/[^a-zA-Z0-9]/g, '-'),
            method: method.toUpperCase(),
            path,
            summary: (operation as any).summary,
            description: (operation as any).description,
          });
        }
      }
    }

    // Extract entrypoint from the response
    const entrypoint = openapi.x_entrypoint || 'main:app';
    delete openapi.x_entrypoint;  // Remove from stored spec

    return {
      openapi,
      endpoints,
      entrypoint,
    };
  } finally {
    // Clean up (best effort)
    try {
      unlinkSync(scriptPath);
    } catch (err) {
      // Ignore
    }
  }
}

/**
 * Execute Python script and return stdout
 */
function executePythonScript(scriptPath: string, timeout: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const python = spawn('python3', [scriptPath]);

    let stdout = '';
    let stderr = '';

    python.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    python.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    python.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(`OpenAPI extraction failed: ${stderr}`));
      }
    });

    python.on('error', (err) => {
      reject(err);
    });

    // Timeout
    setTimeout(() => {
      python.kill();
      reject(new Error('OpenAPI extraction timed out'));
    }, timeout * 1000);
  });
}
