/**
 * Modal Client - Bridge between control-plane and Modal runtime
 *
 * This module calls the deployed Modal functions to execute user code.
 */

import { spawn } from 'child_process';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Find Python with Modal installed (prefer venv)
function findPython(): string {
  // Try venv in project root (3 levels up from this file: src -> control-plane -> services -> execution-layer)
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const projectRoot = join(__dirname, '..', '..', '..');
  const venvPython = join(projectRoot, '.venv', 'bin', 'python3');

  if (existsSync(venvPython)) {
    return venvPython;
  }

  // Fallback to system python
  return 'python3';
}

const PYTHON_PATH = findPython();

interface ModalExecutionRequest {
  run_id: string;
  code_bundle: string;  // base64
  endpoint: string;     // "POST /greet"
  entrypoint?: string;  // e.g., "api:app" - defaults to "main:app"
  request_data: {
    params?: Record<string, any>;
    json?: any;
    headers?: Record<string, string>;
    files?: Array<{
      name: string;
      content: string;  // base64
      mime: string;
    }>;
  };
  secrets_ref?: string;  // KMS-encrypted secrets bundle
  lane: 'cpu' | 'gpu';
  timeout_seconds: number;
}

interface ModalExecutionResult {
  run_id: string;
  status: 'success' | 'error' | 'timeout';
  http_status: number;
  response_body: any;
  duration_ms: number;
  artifacts?: any[];
  logs?: string;
  error_class?: string;
  error_message?: string;
  suggested_fix?: string;
}

/**
 * Convert JSON to Python-compatible string
 * Replaces true/false/null with True/False/None
 */
function jsonToPython(obj: any): string {
  return JSON.stringify(obj)
    .replace(/\btrue\b/g, 'True')
    .replace(/\bfalse\b/g, 'False')
    .replace(/\bnull\b/g, 'None');
}

/**
 * Execute endpoint on Modal runtime
 *
 * This calls the deployed Modal function using Python SDK
 */
export async function executeOnModal(request: ModalExecutionRequest): Promise<ModalExecutionResult> {
  // Create Python script to call Modal
  const pythonScript = `
import modal
import json
import sys

# Get deployed function
run_endpoint_${request.lane} = modal.Function.from_name(
    "execution-layer-runtime",
    "run_endpoint_${request.lane}",
    environment_name="main"
)

# Prepare payload
payload = {
    "run_id": "${request.run_id}",
    "code_bundle": """${request.code_bundle}""",
    "entrypoint": "${request.entrypoint || 'main:app'}",
    "endpoint": "${request.endpoint}",
    "request_data": ${jsonToPython(request.request_data)},
    "env": {},
    "secrets_ref": ${request.secrets_ref ? `"${request.secrets_ref}"` : 'None'},
    "context": {},
    "deps_hash": "no-deps",
    "project_id": "test-project",
    "deterministic": False,
    "timeout_seconds": ${request.timeout_seconds},
}

# Execute
try:
    result = run_endpoint_${request.lane}.remote(payload)
    print(json.dumps(result))
except Exception as e:
    print(json.dumps({
        "run_id": "${request.run_id}",
        "status": "error",
        "http_status": 500,
        "response_body": None,
        "duration_ms": 0,
        "error_class": "MODAL_EXECUTION_ERROR",
        "error_message": str(e),
    }))
    sys.exit(1)
`;

  // Write script to temp file
  const scriptPath = join(tmpdir(), `modal-exec-${request.run_id}.py`);
  writeFileSync(scriptPath, pythonScript);

  try {
    // Execute Python script
    const result = await executePythonScript(scriptPath, request.timeout_seconds + 10);

    // Parse result
    const parsed = JSON.parse(result);

    return {
      run_id: parsed.run_id,
      status: parsed.status,
      http_status: parsed.http_status,
      response_body: parsed.response_body,
      duration_ms: parsed.duration_ms,
      artifacts: parsed.artifacts,
      logs: parsed.logs,
      error_class: parsed.error_class,
      error_message: parsed.error_message,
      suggested_fix: parsed.suggested_fix,
    };
  } finally {
    // Clean up temp file
    try {
      unlinkSync(scriptPath);
    } catch (err) {
      // Ignore cleanup errors
    }
  }
}

/**
 * Execute Python script and return stdout
 */
function executePythonScript(scriptPath: string, timeout: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const python = spawn(PYTHON_PATH, [scriptPath]);

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
        reject(new Error(`Python script failed: ${stderr}`));
      }
    });

    python.on('error', (err) => {
      reject(err);
    });

    // Timeout
    setTimeout(() => {
      python.kill();
      reject(new Error('Modal execution timed out'));
    }, timeout * 1000);
  });
}
