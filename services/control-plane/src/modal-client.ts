/**
 * Modal Client - Bridge between control-plane and Modal runtime
 *
 * This module calls the deployed Modal functions to execute user code.
 * Uses JSON file passing instead of string interpolation to prevent injection.
 */

import { spawn } from 'child_process';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Find Python with Modal installed (prefer venv)
function findPython(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const projectRoot = join(__dirname, '..', '..', '..');
  const venvPython = join(projectRoot, '.venv', 'bin', 'python3');

  if (existsSync(venvPython)) {
    return venvPython;
  }

  return 'python3';
}

const PYTHON_PATH = findPython();

// Fixed Python runner script - reads payload from JSON file, no interpolation
const MODAL_RUNNER_SCRIPT = `
import modal
import json
import sys

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"status": "error", "error_message": "No payload file provided"}))
        sys.exit(1)

    payload_path = sys.argv[1]
    with open(payload_path, "r") as f:
        payload = json.load(f)

    lane = payload.get("lane", "cpu")
    func_name = f"run_endpoint_{lane}"

    fn = modal.Function.from_name(
        "execution-layer-runtime",
        func_name,
        environment_name="main"
    )

    try:
        result = fn.remote(payload)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({
            "run_id": payload.get("run_id", "unknown"),
            "status": "error",
            "http_status": 500,
            "response_body": None,
            "duration_ms": 0,
            "error_class": "MODAL_EXECUTION_ERROR",
            "error_message": str(e),
        }))
        sys.exit(1)

if __name__ == "__main__":
    main()
`;

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
 * Execute endpoint on Modal runtime
 *
 * Uses JSON file passing to avoid command injection.
 * The Python runner script is fixed (no string interpolation).
 */
export async function executeOnModal(request: ModalExecutionRequest): Promise<ModalExecutionResult> {
  const runId = request.run_id.replace(/[^a-zA-Z0-9_-]/g, '');
  const payloadPath = join(tmpdir(), `modal-payload-${runId}.json`);
  const scriptPath = join(tmpdir(), `modal-runner-${runId}.py`);

  // Write payload as JSON file (no interpolation)
  const payload = {
    run_id: request.run_id,
    code_bundle: request.code_bundle,
    entrypoint: request.entrypoint || 'main:app',
    endpoint: request.endpoint,
    request_data: request.request_data,
    env: {},
    secrets_ref: request.secrets_ref || null,
    context: {},
    deps_hash: 'no-deps',
    project_id: 'test-project',
    deterministic: false,
    timeout_seconds: request.timeout_seconds,
    lane: request.lane,
  };

  writeFileSync(payloadPath, JSON.stringify(payload));
  writeFileSync(scriptPath, MODAL_RUNNER_SCRIPT);

  try {
    const result = await executePythonScript(
      scriptPath,
      [payloadPath],
      request.timeout_seconds + 10
    );

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
    // Clean up temp files
    for (const path of [payloadPath, scriptPath]) {
      try {
        unlinkSync(path);
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

/**
 * Execute Python script with arguments and return stdout
 */
function executePythonScript(scriptPath: string, args: string[], timeout: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const python = spawn(PYTHON_PATH, [scriptPath, ...args]);

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
