// ABOUTME: Docker compute backend - executes user code in isolated Docker containers.
// ABOUTME: Runs the runtime-runner image with payload JSON, captures stdout as result.

import { spawn } from 'child_process';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { logger } from '../logger.js';
import type { ComputeBackend, ExecutionRequest, ExecutionResult } from './types.js';

const RUNNER_IMAGE = 'runtime-runner:latest';
const DEFAULT_MEMORY = '4g';
const DEFAULT_CPUS = '4';

export class DockerBackend implements ComputeBackend {
  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    const startTime = Date.now();
    const execId = request.run_id.replace(/[^a-zA-Z0-9_-]/g, '') || randomUUID();
    const workDir = join(tmpdir(), `docker-run-${execId}`);

    try {
      // GPU not supported on Docker backend
      if (request.lane === 'gpu') {
        return {
          run_id: request.run_id,
          status: 'error',
          http_status: 501,
          response_body: null,
          duration_ms: Date.now() - startTime,
          error_class: 'GPU_NOT_SUPPORTED',
          error_message: 'GPU execution is not available on the Docker backend. Use CPU lane instead.',
          suggested_fix: 'Change the lane to "cpu" or use the Modal backend for GPU workloads.',
        };
      }

      // Create workspace and write payload
      mkdirSync(workDir, { recursive: true });

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
        project_id: 'local',
        deterministic: false,
        timeout_seconds: request.timeout_seconds,
        lane: request.lane,
        request_id: request.request_id || null,
      };

      writeFileSync(join(workDir, 'payload.json'), JSON.stringify(payload));

      // Run Docker container
      const timeoutSeconds = Math.min(request.timeout_seconds + 30, 330); // buffer + cap at 5.5min
      const stdout = await this.runContainer(workDir, timeoutSeconds);

      // Parse result
      const result = JSON.parse(stdout);
      return {
        run_id: result.run_id || request.run_id,
        status: result.status || 'error',
        http_status: result.http_status || 500,
        response_body: result.response_body,
        duration_ms: result.duration_ms || (Date.now() - startTime),
        artifacts: result.artifacts,
        logs: result.logs,
        error_class: result.error_class,
        error_message: result.error_message,
        suggested_fix: result.suggested_fix,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Docker execution failed', error instanceof Error ? error : new Error(errorMessage));

      return {
        run_id: request.run_id,
        status: 'error',
        http_status: 500,
        response_body: null,
        duration_ms: Date.now() - startTime,
        error_class: 'DOCKER_EXECUTION_ERROR',
        error_message: errorMessage,
      };
    } finally {
      // Clean up workspace
      try {
        rmSync(workDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    try {
      const result = await this.exec('docker', ['image', 'inspect', RUNNER_IMAGE, '--format', '{{.Id}}']);
      return {
        healthy: true,
        message: `Docker backend ready (image: ${result.trim().substring(0, 19)})`,
      };
    } catch {
      return {
        healthy: false,
        message: `Docker backend unhealthy: ${RUNNER_IMAGE} image not found. Build with: docker build -t ${RUNNER_IMAGE} services/runner/`,
      };
    }
  }

  private runContainer(workDir: string, timeoutSeconds: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const args = [
        'run', '--rm',
        '-v', `${workDir}:/workspace:rw`,
        '--memory', DEFAULT_MEMORY,
        '--cpus', DEFAULT_CPUS,
        '--network', 'bridge', // Allow network for user code (requests, httpx, API calls)
        '--pids-limit', '256',
        '--read-only',
        '--tmpfs', '/tmp:rw,size=512m',
        '--tmpfs', '/app/workspace:rw,size=1g', // writable workspace inside container
        RUNNER_IMAGE,
      ];

      const proc = spawn('docker', args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: timeoutSeconds * 1000,
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      const timer = setTimeout(() => {
        proc.kill('SIGKILL');
        reject(new Error(`Docker container timed out after ${timeoutSeconds}s`));
      }, timeoutSeconds * 1000);

      proc.on('close', (code) => {
        clearTimeout(timer);
        if (stdout.trim()) {
          // Even with non-zero exit, try to parse stdout (runner returns JSON on errors too)
          resolve(stdout.trim());
        } else if (code !== 0) {
          reject(new Error(`Docker container exited with code ${code}: ${stderr.trim()}`));
        } else {
          reject(new Error('Docker container produced no output'));
        }
      });

      proc.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  private exec(command: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => { stdout += data.toString(); });
      proc.stderr.on('data', (data) => { stderr += data.toString(); });

      proc.on('close', (code) => {
        if (code === 0) resolve(stdout);
        else reject(new Error(stderr || `Command failed with code ${code}`));
      });

      proc.on('error', reject);
    });
  }
}
