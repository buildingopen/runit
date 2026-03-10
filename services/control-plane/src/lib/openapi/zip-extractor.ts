// ABOUTME: Extracts OpenAPI specs from ZIP bundles via AST-only static analysis, with auto-wrap for plain scripts.
// ABOUTME: Fallback chain: FastAPI discovery > auto-wrap plain functions > error. Never imports user code (security).
/**
 * OpenAPI Extractor - Extract OpenAPI spec from FastAPI code
 *
 * Uses AST-based static analysis to extract endpoints without importing modules.
 * SECURITY: Runtime import is intentionally removed. User code must never execute
 * on the control-plane host, which has access to MASTER_ENCRYPTION_KEY and other secrets.
 */

import { spawn } from 'child_process';
import { writeFileSync, readFileSync, readdirSync, existsSync, mkdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import AdmZip from 'adm-zip';

import type { OpenAPIPathItem } from '@runit/shared';
import { parseRunitYaml, matchEndpoint, type RunitConfig } from '../runit-yaml.js';

interface ExtractedOpenAPI {
  openapi: Record<string, unknown> | null;
  endpoints: Array<{
    id: string;
    method: string;
    path: string;
    summary?: string;
    description?: string;
    requires_gpu?: boolean;
    requestBody?: Record<string, unknown>;
    responses?: Record<string, unknown>;
  }>;
  entrypoint: string;  // e.g., "api:app" - detected entrypoint
  detected_env_vars: string[];  // Environment variable keys found in code
  auto_wrapped?: boolean;  // true if plain functions were auto-wrapped into FastAPI
  runit_config?: RunitConfig;  // Parsed runit.yaml if present in the bundle
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

# ---- Type hint to JSON schema mapping (for auto-wrap) ----

TYPE_MAP = {
    'str': {'type': 'string'},
    'int': {'type': 'integer'},
    'float': {'type': 'number'},
    'bool': {'type': 'boolean'},
    'list': {'type': 'array', 'items': {}},
    'dict': {'type': 'object'},
    'List': {'type': 'array', 'items': {}},
    'Dict': {'type': 'object'},
    'Any': {},
    'None': {'type': 'null'},
}

def annotation_to_schema(ann):
    """Convert a Python type annotation AST node to a JSON schema dict."""
    if isinstance(ann, ast.Name):
        return TYPE_MAP.get(ann.id, {'type': 'string'})
    if isinstance(ann, ast.Constant):
        return TYPE_MAP.get(str(ann.value), {'type': 'string'})
    if isinstance(ann, ast.Attribute):
        return TYPE_MAP.get(ann.attr, {'type': 'string'})
    if isinstance(ann, ast.Subscript):
        base = ann.value
        if isinstance(base, ast.Name):
            if base.id in ('List', 'list'):
                inner = annotation_to_schema(ann.slice) if ann.slice else {}
                return {'type': 'array', 'items': inner}
            if base.id in ('Dict', 'dict'):
                return {'type': 'object'}
            if base.id == 'Optional':
                inner = annotation_to_schema(ann.slice) if ann.slice else {}
                return inner  # Optional just means nullable
    return {'type': 'string'}

# ---- FastAPI endpoint extraction ----

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

# ---- Auto-wrap: detect plain functions and generate FastAPI wrapper ----

def extract_plain_functions(filepath):
    """Extract top-level functions with type hints from a plain Python script."""
    functions = []
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            source = f.read()
        tree = ast.parse(source)
    except:
        return []

    # Check if this file already imports FastAPI
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                if 'fastapi' in alias.name.lower():
                    return []  # Already a FastAPI app
        if isinstance(node, ast.ImportFrom):
            if node.module and 'fastapi' in node.module.lower():
                return []  # Already a FastAPI app

    # Find top-level function definitions (with or without type hints)
    for node in ast.iter_child_nodes(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            # Skip private/dunder functions
            if node.name.startswith('_'):
                continue

            # Extract parameters; default untyped params to str
            params = []
            for arg in node.args.args:
                if arg.arg == 'self' or arg.arg == 'cls':
                    continue
                param_info = {'name': arg.arg, 'required': True}
                if arg.annotation:
                    param_info['schema'] = annotation_to_schema(arg.annotation)
                else:
                    param_info['schema'] = {'type': 'string'}
                params.append(param_info)

            # Mark params with defaults as optional
            num_defaults = len(node.args.defaults)
            if num_defaults > 0:
                for i, param in enumerate(params[len(params) - num_defaults:]):
                    param['required'] = False

            # Get return type annotation; default to dict if missing
            return_schema = None
            if node.returns:
                return_schema = annotation_to_schema(node.returns)
            else:
                return_schema = {'type': 'object'}

            # Extract docstring
            summary = None
            if (node.body and isinstance(node.body[0], ast.Expr) and
                isinstance(node.body[0].value, ast.Constant) and
                isinstance(node.body[0].value.value, str)):
                summary = node.body[0].value.value.split('\\n')[0].strip()

            # Include any public function (typed or untyped)
            functions.append({
                'name': node.name,
                'params': params,
                'return_schema': return_schema,
                'summary': summary,
                'is_async': isinstance(node, ast.AsyncFunctionDef),
            })

    return functions


def generate_wrapper(filepath, functions):
    """Generate a FastAPI wrapper file that imports and exposes the plain functions."""
    module_name = os.path.basename(filepath).replace('.py', '')
    lines = [
        '# Auto-generated FastAPI wrapper by RunIt',
        'from fastapi import FastAPI',
        'from pydantic import BaseModel',
        'from typing import Any, Optional, List, Dict',
        f'import {module_name} as _user_module',
        '',
        'app = FastAPI(title="RunIt Auto-Wrapped API")',
        '',
    ]

    for func in functions:
        # Generate a Pydantic model for the request body
        model_name = func['name'].title().replace('_', '') + 'Request'
        model_fields = []
        for param in func['params']:
            py_type = _schema_to_python_type(param['schema'])
            if not param['required']:
                model_fields.append(f"    {param['name']}: Optional[{py_type}] = None")
            else:
                model_fields.append(f"    {param['name']}: {py_type}")

        if model_fields:
            lines.append(f'class {model_name}(BaseModel):')
            lines.extend(model_fields)
            lines.append('')

        # Generate the endpoint
        path = f'/{func["name"]}'
        summary_str = f', summary="{func["summary"]}"' if func.get('summary') else ''

        if model_fields:
            lines.append(f'@app.post("{path}"{summary_str})')
            if func['is_async']:
                lines.append(f'async def {func["name"]}_endpoint(body: {model_name}):')
                lines.append(f'    d = body.model_dump(exclude_none=True) if hasattr(body, "model_dump") else body.dict(exclude_none=True)')
                lines.append(f'    return await _user_module.{func["name"]}(**d)')
            else:
                lines.append(f'def {func["name"]}_endpoint(body: {model_name}):')
                lines.append(f'    d = body.model_dump(exclude_none=True) if hasattr(body, "model_dump") else body.dict(exclude_none=True)')
                lines.append(f'    return _user_module.{func["name"]}(**d)')
        else:
            lines.append(f'@app.post("{path}"{summary_str})')
            if func['is_async']:
                lines.append(f'async def {func["name"]}_endpoint():')
                lines.append(f'    return await _user_module.{func["name"]}()')
            else:
                lines.append(f'def {func["name"]}_endpoint():')
                lines.append(f'    return _user_module.{func["name"]}()')
        lines.append('')

    return '\\n'.join(lines)


def _schema_to_python_type(schema):
    """Convert a JSON schema dict back to a Python type string."""
    t = schema.get('type', 'Any')
    if t == 'string': return 'str'
    if t == 'integer': return 'int'
    if t == 'number': return 'float'
    if t == 'boolean': return 'bool'
    if t == 'array': return 'List'
    if t == 'object': return 'Dict'
    if t == 'null': return 'None'
    return 'Any'


# ---- Main extraction logic ----

# Step 1: Try FastAPI endpoint extraction
all_endpoints = []
detected_entrypoint = None
entrypoint_priority = ['main.py', 'app.py', 'api.py', 'server.py']
auto_wrapped = False

for priority_file in entrypoint_priority:
    filepath = os.path.join(app_dir, priority_file)
    if os.path.exists(filepath):
        endpoints, app_var = extract_endpoints_ast(filepath)
        if endpoints:
            all_endpoints = endpoints
            module_name = priority_file.replace('.py', '')
            detected_entrypoint = f"{module_name}:{app_var or 'app'}"
            break

# Step 2: If no FastAPI found, try auto-wrapping plain functions
if not all_endpoints:
    for priority_file in entrypoint_priority:
        filepath = os.path.join(app_dir, priority_file)
        if os.path.exists(filepath):
            functions = extract_plain_functions(filepath)
            if functions:
                # Generate wrapper and write it
                wrapper_code = generate_wrapper(filepath, functions)
                wrapper_path = os.path.join(app_dir, '_runit_wrapper.py')
                with open(wrapper_path, 'w') as f:
                    f.write(wrapper_code)

                # Build endpoints from functions
                for func in functions:
                    ep_path = f'/{func["name"]}'
                    all_endpoints.append({
                        'method': 'POST',
                        'path': ep_path,
                        'summary': func.get('summary', ''),
                        'function': f'{func["name"]}_endpoint',
                    })

                detected_entrypoint = '_runit_wrapper:app'
                auto_wrapped = True
                break

    # Step 3: If still nothing, try all .py files in app_dir
    if not all_endpoints:
        for filename in sorted(os.listdir(app_dir)):
            if filename.endswith('.py') and not filename.startswith('_'):
                filepath = os.path.join(app_dir, filename)
                # Try FastAPI first
                endpoints, app_var = extract_endpoints_ast(filepath)
                if endpoints:
                    all_endpoints = endpoints
                    module_name = filename.replace('.py', '')
                    detected_entrypoint = f"{module_name}:{app_var or 'app'}"
                    break
                # Try auto-wrap
                functions = extract_plain_functions(filepath)
                if functions:
                    wrapper_code = generate_wrapper(filepath, functions)
                    wrapper_path = os.path.join(app_dir, '_runit_wrapper.py')
                    with open(wrapper_path, 'w') as f:
                        f.write(wrapper_code)

                    for func in functions:
                        ep_path = f'/{func["name"]}'
                        all_endpoints.append({
                            'method': 'POST',
                            'path': ep_path,
                            'summary': func.get('summary', ''),
                            'function': f'{func["name"]}_endpoint',
                        })

                    detected_entrypoint = '_runit_wrapper:app'
                    auto_wrapped = True
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

# Build OpenAPI schema
if all_endpoints:
    ast_openapi = {
        "openapi": "3.0.0",
        "info": {"title": "API", "version": "1.0.0"},
        "paths": {}
    }
    for ep in all_endpoints:
        if ep['path'] not in ast_openapi['paths']:
            ast_openapi['paths'][ep['path']] = {}
        ast_openapi['paths'][ep['path']][ep['method'].lower()] = {
            "summary": ep.get('summary', ''),
            "operationId": ep.get('function', '')
        }
    ast_openapi["x_entrypoint"] = detected_entrypoint
    ast_openapi["x_detected_env_vars"] = list(detected_env_vars)
    ast_openapi["x_extraction_method"] = "auto_wrap" if auto_wrapped else "ast"
    ast_openapi["x_auto_wrapped"] = auto_wrapped
    print(json.dumps(ast_openapi))
    sys.exit(0)

print(json.dumps({"error": "No FastAPI endpoints or wrappable functions found (tried main.py, app.py, api.py, server.py, and all .py files)"}))
sys.exit(1)
`;

/**
 * Extract OpenAPI spec from ZIP bundle.
 * If auto-wrapping is needed, also returns an updated code_bundle with the wrapper included.
 */
export async function extractOpenAPIFromZip(zipBase64: string): Promise<ExtractedOpenAPI & { updated_code_bundle?: string }> {
  const workDir = join(tmpdir(), `openapi-extract-${randomUUID()}`);
  // Extract user code to a subdirectory so the script files (extract.py, config.json)
  // don't get picked up during Python file scanning
  const codeDir = join(workDir, 'code');
  mkdirSync(codeDir, { recursive: true });

  // Write the static Python script
  const scriptPath = join(workDir, 'extract.py');
  writeFileSync(scriptPath, EXTRACT_SCRIPT);

  // Write config (base64 data + work dir) to a separate JSON file
  // This avoids interpolating user data into executable code
  const configPath = join(workDir, 'config.json');
  writeFileSync(configPath, JSON.stringify({
    zip_base64: zipBase64,
    work_dir: codeDir,
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
      requestBody?: Record<string, unknown>;
      responses?: Record<string, unknown>;
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
    const autoWrapped = !!openapi.x_auto_wrapped;
    delete openapi.x_entrypoint;  // Remove from stored spec
    delete openapi.x_detected_env_vars;
    delete openapi.x_auto_wrapped;

    // If auto-wrapped, re-bundle the ZIP with the wrapper included
    let updated_code_bundle: string | undefined;
    if (autoWrapped) {
      updated_code_bundle = rebundleWithWrapper(zipBase64, codeDir);
    }

    // Read runit.yaml if present in the bundle
    const runitConfig = readRunitYamlFromBundle(zipBase64);

    // Merge runit.yaml metadata over auto-detected endpoints
    if (runitConfig?.endpoints) {
      for (const ep of endpoints) {
        for (const [configKey, configValue] of Object.entries(runitConfig.endpoints)) {
          if (matchEndpoint(configKey, ep)) {
            if (configValue.summary) ep.summary = configValue.summary;
            if (configValue.description) ep.description = configValue.description;
            if (configValue.inputs) {
              ep.requestBody = schemaToOpenAPIRequestBody(configValue.inputs as unknown as Record<string, unknown>);
            }
            if (configValue.outputs) {
              ep.responses = schemaToOpenAPIResponses(configValue.outputs as unknown as Record<string, unknown>);
            }
          }
        }
      }
    }

    // Merge runit.yaml secrets into detected_env_vars
    if (runitConfig?.secrets) {
      const secretNames = Array.isArray(runitConfig.secrets)
        ? runitConfig.secrets
        : Object.keys(runitConfig.secrets);
      for (const name of secretNames) {
        if (!detected_env_vars.includes(name)) {
          detected_env_vars.push(name);
        }
      }
    }

    return {
      openapi,
      endpoints,
      entrypoint: runitConfig?.entrypoint || entrypoint,
      detected_env_vars,
      auto_wrapped: autoWrapped,
      updated_code_bundle,
      runit_config: runitConfig || undefined,
    };
  } finally {
    // Clean up entire work directory (extracted user code + scripts)
    try { rmSync(workDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

/**
 * Re-bundle a ZIP with the auto-generated wrapper file included.
 * Called when auto_wrapped is true so the runner can find _runit_wrapper.py.
 */
export function rebundleWithWrapper(originalZipBase64: string, workDir: string): string {
  // Find the wrapper file generated by the Python script
  // It could be at workDir/_runit_wrapper.py or workDir/<subdir>/_runit_wrapper.py
  let wrapperContent: string | null = null;
  let wrapperRelPath = '_runit_wrapper.py';

  const directWrapper = join(workDir, '_runit_wrapper.py');
  if (existsSync(directWrapper)) {
    wrapperContent = readFileSync(directWrapper, 'utf-8');
  } else {
    // Check one level deep (nested folder case)
    const items = readdirSync(workDir).filter((f: string) => !f.startsWith('.') && f !== '__pycache__');
    for (const item of items) {
      const nested = join(workDir, item, '_runit_wrapper.py');
      if (existsSync(nested)) {
        wrapperContent = readFileSync(nested, 'utf-8');
        wrapperRelPath = `${item}/_runit_wrapper.py`;
        break;
      }
    }
  }

  if (!wrapperContent) {
    return originalZipBase64; // No wrapper found, return original
  }

  // Add wrapper to the existing ZIP
  const zip = new AdmZip(Buffer.from(originalZipBase64, 'base64'));
  zip.addFile(wrapperRelPath, Buffer.from(wrapperContent, 'utf-8'));
  return zip.toBuffer().toString('base64');
}

/**
 * Read runit.yaml from a base64-encoded ZIP bundle.
 * Looks for runit.yaml or runit.yml at the root or one level deep.
 */
function readRunitYamlFromBundle(zipBase64: string): RunitConfig | null {
  try {
    const zip = new AdmZip(Buffer.from(zipBase64, 'base64'));
    const entries = zip.getEntries();

    // Look for runit.yaml/runit.yml at root or one level deep
    const candidates = ['runit.yaml', 'runit.yml'];
    for (const entry of entries) {
      const name = entry.entryName;
      const basename = name.split('/').pop();
      const depth = name.split('/').filter(Boolean).length;
      if (basename && candidates.includes(basename) && depth <= 2) {
        const content = entry.getData().toString('utf-8');
        return parseRunitYaml(content);
      }
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

/**
 * Convert a runit.yaml SchemaDefinition to an OpenAPI requestBody object.
 */
function schemaToOpenAPIRequestBody(schema: Record<string, unknown>): Record<string, unknown> {
  return {
    content: {
      'application/json': {
        schema,
      },
    },
  };
}

/**
 * Convert a runit.yaml SchemaDefinition to an OpenAPI responses object.
 */
function schemaToOpenAPIResponses(schema: Record<string, unknown>): Record<string, unknown> {
  return {
    '200': {
      description: 'Successful response',
      content: {
        'application/json': {
          schema,
        },
      },
    },
  };
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
