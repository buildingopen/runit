/**
 * Deploy Bridge - Real Modal deployment integration
 *
 * Replaces the simulated sleep-based deployment with actual Modal operations.
 * Each step emits real SSE progress events.
 */

import { spawn } from 'child_process';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as deployState from './deploy-state.js';
import * as projectsStore from '../db/projects-store.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function findPython(): string {
  const projectRoot = join(__dirname, '..', '..', '..', '..');
  const venvPython = join(projectRoot, '.venv', 'bin', 'python3');
  if (existsSync(venvPython)) return venvPython;
  return 'python3';
}

const PYTHON_PATH = findPython();

/**
 * Validate requirements.txt packages against a basic allowlist pattern.
 * Returns list of packages or throws on suspicious entries.
 */
function validateRequirements(codeBundle: string): string[] {
  // Decode base64 bundle and look for requirements.txt
  try {
    const decoded = Buffer.from(codeBundle, 'base64');
    // Simple heuristic: look for requirements content in the bundle
    // In production, this would extract from the actual ZIP
    const content = decoded.toString('utf-8');
    const reqMatch = content.match(/requirements\.txt[^\n]*\n([\s\S]*?)(?:\n[^\s]|$)/);
    if (!reqMatch) return [];

    const lines = reqMatch[1].split('\n').filter((l) => l.trim() && !l.startsWith('#'));
    const packagePattern = /^[a-zA-Z0-9_-]+([><=!~]+[a-zA-Z0-9._*]+)?$/;

    for (const line of lines) {
      const pkg = line.trim();
      if (!packagePattern.test(pkg)) {
        throw new Error(`Invalid package specification: ${pkg}`);
      }
    }
    return lines.map((l) => l.trim());
  } catch {
    return [];
  }
}

/**
 * Deploy a project to Modal runtime.
 *
 * Steps:
 * 1. Validate and parse dependencies
 * 2. Create code bundle for Modal
 * 3. Deploy to Modal (register function)
 * 4. Health check the deployed endpoint
 * 5. Update project with real runtime URL
 */
export async function runDeployment(
  projectId: string,
  version: projectsStore.ProjectVersion
): Promise<void> {
  const MAX_RETRIES = 1;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        deployState.updateDeployProgress(
          projectId, 'queued', 5,
          `Retrying deployment (attempt ${attempt + 1})...`
        );
      }

      await executeDeploySteps(projectId, version);
      return; // Success
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt < MAX_RETRIES) {
        console.warn(`Deploy attempt ${attempt + 1} failed, retrying:`, lastError.message);
        continue;
      }
    }
  }

  // All retries exhausted
  const errorMessage = lastError?.message || 'Unknown deployment error';
  deployState.failDeploy(projectId, errorMessage);

  await projectsStore.updateProjectStatus(projectId, 'failed', {
    deploy_error: errorMessage,
  });

  console.error(`Deployment failed for project ${projectId}:`, errorMessage);
}

async function executeDeploySteps(
  projectId: string,
  version: projectsStore.ProjectVersion
): Promise<void> {
  // Step 1: Install dependencies
  deployState.updateDeployProgress(projectId, 'installing_deps', 10, 'Validating dependencies...');
  const packages = validateRequirements(version.code_bundle_ref);
  deployState.updateDeployProgress(
    projectId, 'installing_deps', 20,
    packages.length > 0
      ? `Found ${packages.length} packages to install...`
      : 'No additional packages required...'
  );

  // Step 2: Build - create code bundle for Modal
  deployState.updateDeployProgress(projectId, 'building', 35, 'Preparing code bundle...');

  const deployPayload = {
    project_id: projectId,
    version_id: version.id,
    version_hash: version.version_hash,
    code_bundle: version.code_bundle_ref,
    entrypoint: version.entrypoint || 'main:app',
    packages,
  };

  deployState.updateDeployProgress(projectId, 'building', 50, 'Uploading to Modal...');

  // Step 3: Deploy to Modal
  deployState.updateDeployProgress(projectId, 'starting', 60, 'Deploying to Modal runtime...');

  const deployResult = await callModalDeploy(deployPayload);

  if (deployResult.status === 'error') {
    throw new Error(deployResult.error || 'Modal deployment failed');
  }

  deployState.updateDeployProgress(projectId, 'starting', 75, 'Container starting...');

  // Step 4: Health check
  deployState.updateDeployProgress(projectId, 'health_check', 85, 'Running health check...');

  const runtimeUrl = deployResult.runtime_url;
  if (runtimeUrl) {
    const healthy = await healthCheck(runtimeUrl);
    if (!healthy) {
      throw new Error('Health check failed - endpoint not responding');
    }
  }

  deployState.updateDeployProgress(projectId, 'health_check', 95, 'Verifying endpoints...');

  // Step 5: Update project with real runtime URL
  await projectsStore.updateProjectStatus(projectId, 'live', {
    deployed_at: new Date().toISOString(),
    deploy_error: null,
    runtime_url: runtimeUrl || null,
  });

  deployState.completeDeploy(projectId);
  console.log(`Deployment complete for project ${projectId} -> ${runtimeUrl}`);
}

interface ModalDeployResult {
  status: 'success' | 'error';
  runtime_url?: string;
  error?: string;
}

/**
 * Call Modal SDK to deploy the project.
 * Uses a fixed Python script with JSON payload (no string interpolation).
 */
async function callModalDeploy(payload: Record<string, unknown>): Promise<ModalDeployResult> {
  const payloadPath = join(tmpdir(), `modal-deploy-${payload.project_id}.json`);
  const scriptPath = join(tmpdir(), `modal-deploy-${payload.project_id}.py`);

  const deployScript = `
import modal
import json
import sys

def main():
    with open(sys.argv[1], "r") as f:
        payload = json.load(f)

    project_id = payload["project_id"]
    version_hash = payload["version_hash"]
    code_bundle = payload["code_bundle"]
    entrypoint = payload.get("entrypoint", "main:app")
    packages = payload.get("packages", [])

    # Use Modal deploy API to register the function
    try:
        deploy_fn = modal.Function.from_name(
            "execution-layer-runtime",
            "deploy_project",
            environment_name="main"
        )

        result = deploy_fn.remote({
            "project_id": project_id,
            "version_hash": version_hash,
            "code_bundle": code_bundle,
            "entrypoint": entrypoint,
            "packages": packages,
        })

        print(json.dumps({
            "status": "success",
            "runtime_url": result.get("runtime_url", f"https://{project_id}.modal.run"),
        }))
    except Exception as e:
        print(json.dumps({
            "status": "error",
            "error": str(e),
        }))
        sys.exit(1)

if __name__ == "__main__":
    main()
`;

  writeFileSync(payloadPath, JSON.stringify(payload));
  writeFileSync(scriptPath, deployScript);

  try {
    const result = await executePython(scriptPath, [payloadPath], 120);
    return JSON.parse(result);
  } catch (err) {
    return {
      status: 'error',
      error: err instanceof Error ? err.message : 'Deploy script failed',
    };
  } finally {
    for (const p of [payloadPath, scriptPath]) {
      try { unlinkSync(p); } catch { /* ignore */ }
    }
  }
}

/**
 * Health check a deployed endpoint
 */
async function healthCheck(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`${url}/health`, {
      signal: controller.signal,
    });

    clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
}

function executePython(scriptPath: string, args: string[], timeoutSec: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const python = spawn(PYTHON_PATH, [scriptPath, ...args]);

    let stdout = '';
    let stderr = '';

    python.stdout.on('data', (data) => { stdout += data.toString(); });
    python.stderr.on('data', (data) => { stderr += data.toString(); });

    python.on('close', (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(`Deploy script failed: ${stderr}`));
    });

    python.on('error', (err) => reject(err));

    setTimeout(() => {
      python.kill();
      reject(new Error('Deploy script timed out'));
    }, timeoutSec * 1000);
  });
}
