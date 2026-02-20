// ABOUTME: Executes user code on Modal by spawning a Python runner script with JSON file payloads (no string interpolation).
// ABOUTME: Includes retry with exponential backoff, circuit breaker integration, and OpenTelemetry tracing.
/**
 * Modal Client - Bridge between control-plane and Modal runtime
 *
 * This module calls the deployed Modal functions to execute user code.
 * Uses JSON file passing instead of string interpolation to prevent injection.
 * Includes retry logic with exponential backoff for transient failures.
 */

import { spawn } from 'child_process';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../logger';
import { captureException } from '../sentry';
import { getModalCircuitBreaker, withCircuitBreaker } from '../circuit-breaker';
import { runsTotal, runDuration, errorsTotal } from '../metrics';
import { withModalExecutionSpan, recordModalResult } from '../tracing';

// Find Python with Modal installed (prefer venv)
function findPython(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const projectRoot = join(__dirname, '..', '..', '..', '..', '..');
  const venvPython = join(projectRoot, '.venv', 'bin', 'python3');

  if (existsSync(venvPython)) {
    return venvPython;
  }

  return 'python3';
}

const PYTHON_PATH = findPython();

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000,  // 1s, 2s, 4s exponential backoff
  maxDelayMs: 10000,  // Cap at 10s
};

// Errors that should NOT be retried (user code errors)
const NON_RETRYABLE_ERRORS = [
  'SyntaxError',
  'NameError',
  'TypeError',
  'ValueError',
  'AttributeError',
  'ImportError',
  'ModuleNotFoundError',
  'KeyError',
  'IndexError',
  'USER_CODE_ERROR',
];

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
    params?: Record<string, unknown>;
    json?: unknown;
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

interface Artifact {
  name: string;
  size: number;
  mime?: string;
  mime_type?: string;
  url?: string;
  data?: string;  // base64
}

interface ModalExecutionResult {
  run_id: string;
  status: 'success' | 'error' | 'timeout';
  http_status: number;
  response_body: unknown;
  duration_ms: number;
  artifacts?: Artifact[];
  logs?: string;
  error_class?: string;
  error_message?: string;
  suggested_fix?: string;
}

/**
 * Check if an error is transient and should be retried
 */
function isTransientError(result: ModalExecutionResult): boolean {
  if (result.status === 'timeout') return true;

  if (result.error_class) {
    // Don't retry user code errors
    if (NON_RETRYABLE_ERRORS.includes(result.error_class)) {
      return false;
    }
    // Retry Modal/network errors
    if (
      result.error_class.includes('MODAL') ||
      result.error_class.includes('NETWORK') ||
      result.error_class.includes('TIMEOUT') ||
      result.error_class.includes('CONNECTION')
    ) {
      return true;
    }
  }

  // Retry on 5xx errors (server errors) but not 4xx (client errors)
  if (result.http_status >= 500) return true;

  return false;
}

/**
 * Sleep for a given duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function getRetryDelay(attempt: number): number {
  const exponentialDelay = RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt);
  const jitter = Math.random() * 0.3 * exponentialDelay;  // 0-30% jitter
  return Math.min(exponentialDelay + jitter, RETRY_CONFIG.maxDelayMs);
}

/**
 * Execute endpoint on Modal runtime
 *
 * Uses JSON file passing to avoid command injection.
 * The Python runner script is fixed (no string interpolation).
 * Includes retry logic with exponential backoff for transient failures.
 * Wrapped with OpenTelemetry tracing for observability.
 */
export async function executeOnModal(request: ModalExecutionRequest): Promise<ModalExecutionResult> {
  const startTime = Date.now();
  const circuitBreaker = getModalCircuitBreaker();

  return withModalExecutionSpan(
    request.run_id,
    request.lane,
    request.endpoint,
    async (span) => {
      const result = await withCircuitBreaker(
        circuitBreaker,
        async () => executeWithRetry(request, startTime),
        // Fallback when circuit is open
        () => ({
          run_id: request.run_id,
          status: 'error' as const,
          http_status: 503,
          response_body: null,
          duration_ms: Date.now() - startTime,
          error_class: 'CIRCUIT_BREAKER_OPEN',
          error_message: 'Modal service is temporarily unavailable. Please try again later.',
        })
      );

      // Record result attributes on the span
      recordModalResult(
        span,
        result.status,
        result.http_status,
        result.duration_ms,
        result.error_class,
        result.error_message
      );

      return result;
    }
  );
}

/**
 * Execute with retry logic
 */
async function executeWithRetry(
  request: ModalExecutionRequest,
  startTime: number
): Promise<ModalExecutionResult> {
  let lastResult: ModalExecutionResult | null = null;

  for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    try {
      const result = await executeOnModalOnce(request);
      lastResult = result;

      // Track metrics
      const duration = (Date.now() - startTime) / 1000;
      runsTotal.inc({ status: result.status, lane: request.lane });
      runDuration.observe({ status: result.status, lane: request.lane }, duration);

      if (result.status === 'success' || !isTransientError(result)) {
        // Success or non-retryable error - return immediately
        return result;
      }

      // Transient error - retry if we have attempts left
      if (attempt < RETRY_CONFIG.maxRetries) {
        const delay = getRetryDelay(attempt);
        logger.warn(`Modal execution failed (attempt ${attempt + 1}/${RETRY_CONFIG.maxRetries + 1}), retrying in ${delay}ms`, {
          runId: request.run_id,
          errorClass: result.error_class,
          errorMessage: result.error_message,
        });
        await sleep(delay);
      }
    } catch (error) {
      // Unexpected error
      const errorMessage = error instanceof Error ? error.message : String(error);
      errorsTotal.inc({ type: 'modal_execution', code: 'UNEXPECTED_ERROR' });

      if (attempt < RETRY_CONFIG.maxRetries) {
        const delay = getRetryDelay(attempt);
        logger.warn(`Modal execution threw error (attempt ${attempt + 1}/${RETRY_CONFIG.maxRetries + 1}), retrying in ${delay}ms`, {
          runId: request.run_id,
          error: errorMessage,
        });
        await sleep(delay);
      } else {
        // Final attempt failed
        captureException(error instanceof Error ? error : new Error(errorMessage), {
          runId: request.run_id,
          attempt,
        });
        return {
          run_id: request.run_id,
          status: 'error',
          http_status: 500,
          response_body: null,
          duration_ms: Date.now() - startTime,
          error_class: 'UNEXPECTED_ERROR',
          error_message: errorMessage,
        };
      }
    }
  }

  // All retries exhausted
  logger.error('Modal execution failed after all retries', undefined, {
    runId: request.run_id,
    attempts: RETRY_CONFIG.maxRetries + 1,
  });

  return lastResult || {
    run_id: request.run_id,
    status: 'error',
    http_status: 500,
    response_body: null,
    duration_ms: Date.now() - startTime,
    error_class: 'RETRY_EXHAUSTED',
    error_message: `Execution failed after ${RETRY_CONFIG.maxRetries + 1} attempts`,
  };
}

/**
 * Execute a single Modal call (no retry)
 */
async function executeOnModalOnce(request: ModalExecutionRequest): Promise<ModalExecutionResult> {
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
