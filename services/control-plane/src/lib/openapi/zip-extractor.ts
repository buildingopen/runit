// ABOUTME: Extracts OpenAPI specs from FastAPI ZIP bundles by spawning a Python script that does AST + runtime analysis.
// ABOUTME: Detects endpoints, entrypoints, and environment variables; falls back from runtime import to AST parsing on failure.
/**
 * OpenAPI Extractor - Extract OpenAPI spec from FastAPI code
 *
 * Uses AST-based static analysis to extract endpoints without importing modules.
 * This allows extraction to work even when dependencies are not installed.
 *
 * Fallback: If AST extraction finds no endpoints, tries runtime import (original approach).
 */

import { spawn } from 'child_process';
import { writeFileSync, unlinkSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';

import type { OpenAPIPathItem } from '@runtime-ai/shared';

interface ExtractedOpenAPI {
  openapi: Record<string, unknown> | null;
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
 * Static Python extraction script.
 * Reads base64 ZIP data and work directory path from a JSON config file
 * passed as first argument. No user data is interpolated into the script.
 */
const EXTRACT_SCRIPT = `
import base64
import io
import json
import sys
import os
import zipfile
import ast
import re
from pathlib import Path

# Read config from file (passed as argv[1])
with open(sys.argv[1], 'r') as f:
    config = json.load(f)

zip_b64 = config['zip_base64']
work_dir = os.path.realpath(config['work_dir'])

# Decode and extract ZIP (with zip-slip protection)
zip_data = base64.b64decode(zip_b64)
with zipfile.ZipFile(io.BytesIO(zip_data)) as zf:
    for member in zf.namelist():
        target = os.path.realpath(os.path.join(work_dir, member))
        if not target.startswith(work_dir + os.sep) and target != work_dir:
            raise ValueError(f"Zip slip detected: {member}")
    zf.extractall(work_dir)

# Find the app directory (might be nested in a folder)
app_dir = work_dir
items = [f for f in os.listdir(app_dir) if not f.startswith('.') and f != '__pycache__']
if len(items) == 1 and os.path.isdir(os.path.join(app_dir, items[0])):
    app_dir = os.path.join(app_dir, items[0])

def extract_endpoints_ast(filepath):
    """Extract FastAPI endpoints using AST parsing (no import needed)."""
    endpoints = []
    app_var = None

    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            source = f.read()
        tree = ast.parse(source)
    except:
        return [], None

    # Find FastAPI app variable name
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and isinstance(node.value, ast.Call):
                    if isinstance(node.value.func, ast.Name) and node.value.func.id == 'FastAPI':
                        app_var = target.id
                    elif isinstance(node.value.func, ast.Attribute) and node.value.func.attr == 'FastAPI':
                        app_var = target.id

    if not app_var:
        return [], None

    # Find decorated functions (route handlers)
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef) or isinstance(node, ast.AsyncFunctionDef):
            for decorator in node.decorator_list:
                method = None
                path = None

                # Handle @app.get("/path"), @app.post("/path"), etc.
                if isinstance(decorator, ast.Call):
                    if isinstance(decorator.func, ast.Attribute):
                        if isinstance(decorator.func.value, ast.Name) and decorator.func.value.id == app_var:
                            method = decorator.func.attr.upper()
                            if decorator.args and isinstance(decorator.args[0], ast.Constant):
                                path = decorator.args[0].value

                if method and path and method in ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']:
                    # Extract docstring as summary
                    summary = None
                    if (node.body and isinstance(node.body[0], ast.Expr) and
                        isinstance(node.body[0].value, ast.Constant) and
                        isinstance(node.body[0].value.value, str)):
                        docstring = node.body[0].value.value
                        summary = docstring.split('\\n')[0].strip()

                    endpoints.append({
                        'method': method,
                        'path': path,
                        'summary': summary,
                        'function': node.name
                    })

    return endpoints, app_var

# Find Python files and extract endpoints
all_endpoints = []
detected_entrypoint = None
entrypoint_priority = ['main.py', 'app.py', 'api.py', 'server.py']

for priority_file in entrypoint_priority:
    filepath = os.path.join(app_dir, priority_file)
    if os.path.exists(filepath):
        endpoints, app_var = extract_endpoints_ast(filepath)
        if endpoints:
            all_endpoints = endpoints
            module_name = priority_file.replace('.py', '')
            detected_entrypoint = f"{module_name}:{app_var or 'app'}"
            break

# Detect environment variables from all Python files
detected_env_vars = set()
for root, dirs, files in os.walk(app_dir):
    dirs[:] = [d for d in dirs if d not in ['__pycache__', '.git', 'node_modules', 'venv', '.venv']]
    for filename in files:
        if filename.endswith('.py'):
            filepath = os.path.join(root, filename)
            try:
                with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                    patterns = [
                        r'os\\.environ\\["([A-Z_][A-Z0-9_]*)"\\]',
                        r"os\\.environ\\['([A-Z_][A-Z0-9_]*)'\\]",
                        r'os\\.environ\\.get\\("([A-Z_][A-Z0-9_]*)"',
                        r"os\\.environ\\.get\\('([A-Z_][A-Z0-9_]*)'",
                        r'os\\.getenv\\("([A-Z_][A-Z0-9_]*)"',
                        r"os\\.getenv\\('([A-Z_][A-Z0-9_]*)'",
                    ]
                    for pattern in patterns:
                        matches = re.findall(pattern, content)
                        detected_env_vars.update(matches)
            except:
                pass

# Store AST fallback schema in case runtime import fails
ast_fallback_openapi = None
if all_endpoints:
    ast_fallback_openapi = {
        "openapi": "3.0.0",
        "info": {"title": "API", "version": "1.0.0"},
        "paths": {}
    }
    for ep in all_endpoints:
        if ep['path'] not in ast_fallback_openapi['paths']:
            ast_fallback_openapi['paths'][ep['path']] = {}
        ast_fallback_openapi['paths'][ep['path']][ep['method'].lower()] = {
            "summary": ep.get('summary', ''),
            "operationId": ep.get('function', '')
        }
    ast_fallback_openapi["x_entrypoint"] = detected_entrypoint
    ast_fallback_openapi["x_detected_env_vars"] = list(detected_env_vars)
    ast_fallback_openapi["x_extraction_method"] = "ast"

# ALWAYS try runtime import to get full schema with requestBody definitions
# Add to Python path
sys.path.insert(0, app_dir)
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
    # Fall back to AST-extracted schema if available
    if ast_fallback_openapi:
        print(json.dumps(ast_fallback_openapi))
        sys.exit(0)
    print(json.dumps({"error": "Could not find FastAPI app (tried main:app, app:app, api:app, server:app)"}))
    sys.exit(1)

# Extract OpenAPI spec with full schema (includes requestBody definitions)
try:
    openapi_spec = app.openapi()
    # Add entrypoint and detected env vars to the response
    openapi_spec["x_entrypoint"] = detected_entrypoint
    openapi_spec["x_detected_env_vars"] = list(detected_env_vars)
    openapi_spec["x_extraction_method"] = "runtime"
    print(json.dumps(openapi_spec))
except Exception as e:
    # Fall back to AST-extracted schema if runtime extraction fails
    if ast_fallback_openapi:
        print(json.dumps(ast_fallback_openapi))
        sys.exit(0)
    print(json.dumps({"error": f"Failed to extract OpenAPI: {str(e)}"}))
    sys.exit(1)
`;

/**
 * Extract OpenAPI spec from ZIP bundle
 */
export async function extractOpenAPIFromZip(zipBase64: string): Promise<ExtractedOpenAPI> {
  const workDir = join(tmpdir(), `openapi-extract-${randomUUID()}`);
  mkdirSync(workDir, { recursive: true });

  // Write the static Python script
  const scriptPath = join(workDir, 'extract.py');
  writeFileSync(scriptPath, EXTRACT_SCRIPT);

  // Write config (base64 data + work dir) to a separate JSON file
  // This avoids interpolating user data into executable code
  const configPath = join(workDir, 'config.json');
  writeFileSync(configPath, JSON.stringify({
    zip_base64: zipBase64,
    work_dir: workDir,
  }));

  try {
    // Execute Python script with config file as argument
    const result = await executePythonScript(scriptPath, [configPath], 60);

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

    const paths = (openapi.paths || {}) as Record<string, OpenAPIPathItem>;
    for (const [path, pathItem] of Object.entries(paths)) {
      const methods = ['get', 'post', 'put', 'delete', 'patch'] as const;
      for (const method of methods) {
        const operation = pathItem[method];
        if (operation) {
          endpoints.push({
            id: `${method}-${path}`.replace(/[^a-zA-Z0-9]/g, '-'),
            method: method.toUpperCase(),
            path,
            summary: operation.summary,
            description: operation.description,
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
    try { unlinkSync(scriptPath); } catch { /* ignore */ }
    try { unlinkSync(configPath); } catch { /* ignore */ }
  }
}

/**
 * Execute Python script and return stdout
 */
function executePythonScript(scriptPath: string, args: string[], timeout: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const python = spawn('python3', [scriptPath, ...args]);

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
