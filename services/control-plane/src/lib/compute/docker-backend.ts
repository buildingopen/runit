// ABOUTME: Docker compute backend - executes user code in isolated Docker containers.
// ABOUTME: Runs the runit-runner image with payload JSON, captures stdout as result.

import { spawn } from 'child_process';
import { writeFileSync, mkdirSync, rmSync, existsSync, chmodSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { logger } from '../logger.js';
import type { ComputeBackend, ExecutionRequest, ExecutionResult } from './types.js';

const RUNNER_IMAGE = process.env.RUNNER_IMAGE || 'runit-runner:latest';
const DEFAULT_MEMORY = process.env.RUNNER_MEMORY || '512m';
const DEFAULT_CPUS = process.env.RUNNER_CPUS || '1';
// Workspace directory for run payloads. Must be a path visible to the Docker daemon (host path)
// when running inside a container via Docker socket. Set RUNNER_WORKSPACE_DIR to a host-mounted directory.
const WORKSPACE_DIR = process.env.RUNNER_WORKSPACE_DIR || tmpdir();
// Storage base directory for persistent project data. Must be a host-visible path
// (same concern as RUNNER_WORKSPACE_DIR when control plane runs in Docker).
const STORAGE_BASE_DIR = process.env.RUNNER_STORAGE_BASE_DIR || join(process.env.RUNIT_DATA_DIR || '/data', 'storage');

export class DockerBackend implements ComputeBackend {
  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    const startTime = Date.now();
    const execId = request.run_id.replace(/[^a-zA-Z0-9_-]/g, '') || randomUUID();
    const workDir = join(WORKSPACE_DIR, `docker-run-${execId}`);

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

      const projectId = request.project_id || 'local';
      const depsHash = request.deps_hash || 'no-deps';

      const payload = {
        run_id: request.run_id,
        code_bundle: request.code_bundle,
        entrypoint: request.entrypoint || 'main:app',
        endpoint: request.endpoint,
        request_data: request.request_data,
        env: {},
        secrets_ref: request.secrets_ref || null,
        context: {},
        deps_hash: depsHash,
        project_id: projectId,
        deterministic: false,
        timeout_seconds: request.timeout_seconds,
        lane: request.lane,
        request_id: request.request_id || null,
      };

      writeFileSync(join(workDir, 'payload.json'), JSON.stringify(payload));

      // Ensure storage + dep cache directories exist on host.
      // chmod 777: runner containers drop ALL capabilities (including DAC_OVERRIDE),
      // so the process inside can't write to dirs it doesn't own even as root.
      const storageDir = join(STORAGE_BASE_DIR, projectId);
      const depsCacheDir = join(STORAGE_BASE_DIR, '..', 'deps-cache', depsHash);
      mkdirSync(storageDir, { recursive: true });
      chmodSync(storageDir, 0o777);
      mkdirSync(depsCacheDir, { recursive: true });
      chmodSync(depsCacheDir, 0o777);

      // Run Docker container
      const timeoutSeconds = Math.min(request.timeout_seconds + 30, 330); // buffer + cap at 5.5min
      const stdout = await this.runContainer(workDir, timeoutSeconds, projectId, depsHash);

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

  private runContainer(workDir: string, timeoutSeconds: number, projectId?: string, depsHash?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // Network mode: default to 'none' for security, opt-in via RUNNER_NETWORK env
      const networkMode = process.env.RUNNER_NETWORK || 'none';

      const args = [
        'run', '--rm',
        '-v', `${workDir}:/workspace:rw`,
        '--memory', DEFAULT_MEMORY,
        '--cpus', DEFAULT_CPUS,
        '--network', networkMode,
        '--pids-limit', '256',
        '--read-only',
        '--tmpfs', '/tmp:rw,size=512m',
        '--tmpfs', '/app/workspace:rw,size=1g',
        '--cap-drop', 'ALL',
        '--security-opt', 'no-new-privileges:true',
        '--stop-timeout', '30',
      ];

      // Mount persistent storage volume
      if (projectId && projectId !== 'local') {
        const storageDir = join(STORAGE_BASE_DIR, projectId);
        args.push('-v', `${storageDir}:/storage:rw`);
        args.push('-e', 'RUNIT_STORAGE_DIR=/storage');
        args.push('-e', `EL_PROJECT_ID=${projectId}`);
      }

      // Mount pip dep cache volume
      if (depsHash && depsHash !== 'no-deps') {
        const depsCacheDir = join(STORAGE_BASE_DIR, '..', 'deps-cache', depsHash);
        args.push('-v', `${depsCacheDir}:/root/.cache/pip:rw`);
      }

      args.push(RUNNER_IMAGE);

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
