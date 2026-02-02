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
  detected_env_vars: string[];  // Environment variable keys found in code
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

# Detect environment variables used in code
import re
detected_env_vars = set()
for root, dirs, files in os.walk(app_dir):
    # Skip common non-code directories
    dirs[:] = [d for d in dirs if d not in ['__pycache__', '.git', 'node_modules', 'venv', '.venv']]
    for filename in files:
        if filename.endswith('.py'):
            filepath = os.path.join(root, filename)
            try:
                with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                    # Match os.environ["KEY"], os.environ.get("KEY"), os.getenv("KEY")
                    patterns = [
                        r'os\\.environ\\[[\\'"]([A-Z_][A-Z0-9_]*)[\\'"]\\]',
                        r'os\\.environ\\.get\\([\\'"]([A-Z_][A-Z0-9_]*)[\\'"\\)]',
                        r'os\\.getenv\\([\\'"]([A-Z_][A-Z0-9_]*)[\\'"\\)]',
                        r'environ\\.get\\([\\'"]([A-Z_][A-Z0-9_]*)[\\'"\\)]',
                        r'environ\\[[\\'"]([A-Z_][A-Z0-9_]*)[\\'"]\\]',
                    ]
                    for pattern in patterns:
                        matches = re.findall(pattern, content)
                        detected_env_vars.update(matches)
            except Exception:
                pass

# Extract OpenAPI spec
try:
    openapi_spec = app.openapi()
    # Add entrypoint and detected env vars to the response
    openapi_spec["x_entrypoint"] = detected_entrypoint
    openapi_spec["x_detected_env_vars"] = list(detected_env_vars)
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

    // Extract entrypoint and detected env vars from the response
    const entrypoint = openapi.x_entrypoint || 'main:app';
    const detected_env_vars = (openapi.x_detected_env_vars || []) as string[];
    delete openapi.x_entrypoint;  // Remove from stored spec
    delete openapi.x_detected_env_vars;

    return {
      openapi,
      endpoints,
      entrypoint,
      detected_env_vars,
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
