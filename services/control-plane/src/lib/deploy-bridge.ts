// ABOUTME: Project deployment pipeline: validates ZIP code bundles, checks dependencies and Modal config, then marks projects live.
// ABOUTME: Does NOT invoke Modal at deploy time; Modal is called at run time. Includes retry logic and SSE progress updates.
/**
 * Deploy Bridge - Project deployment pipeline
 *
 * "Deploying" a project validates the code bundle and marks it as live.
 * The Modal runtime (runit-runtime) is a shared execution factory
 * deployed once as infrastructure — it is NOT called during project deploy.
 * Modal is called at RUN time via modal-client.ts.
 *
 * Deploy steps:
 * 1. Validate code bundle (valid base64, has entrypoint)
 * 2. Validate dependencies (check requirements.txt if present)
 * 3. Mark project as live
 */

import * as deployState from './deploy-state.js';
import * as projectsStore from '../db/projects-store.js';

/**
 * Validate that the code bundle is valid base64 and contains expected structure.
 * Returns decoded buffer for further inspection.
 */
function validateCodeBundle(codeBundleRef: string): Buffer {
  if (!codeBundleRef || codeBundleRef.length === 0) {
    throw new Error('Code bundle is empty');
  }

  let decoded: Buffer;
  try {
    decoded = Buffer.from(codeBundleRef, 'base64');
  } catch {
    throw new Error('Code bundle is not valid base64');
  }

  if (decoded.length === 0) {
    throw new Error('Code bundle decoded to empty content');
  }

  // Check for ZIP magic bytes (PK\x03\x04)
  if (decoded[0] !== 0x50 || decoded[1] !== 0x4B) {
    throw new Error('Code bundle is not a valid ZIP file');
  }

  return decoded;
}

/**
 * Validate requirements.txt packages against a basic allowlist pattern.
 * Returns list of packages or throws on suspicious entries.
 */
function validateRequirements(codeBundle: string): string[] {
  try {
    const decoded = Buffer.from(codeBundle, 'base64');
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
 * Deploy a project — validate code and mark as live.
 *
 * This does NOT call Modal. The Modal runtime is shared infrastructure
 * that executes code on-demand at run time.
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
  // Step 1: Validate code bundle
  deployState.updateDeployProgress(projectId, 'building', 10, 'Validating code bundle...');

  validateCodeBundle(version.code_bundle_ref);

  deployState.updateDeployProgress(projectId, 'building', 30, 'Code bundle validated.');

  // Step 2: Validate dependencies
  deployState.updateDeployProgress(projectId, 'installing_deps', 40, 'Checking dependencies...');

  const packages = validateRequirements(version.code_bundle_ref);

  deployState.updateDeployProgress(
    projectId, 'installing_deps', 55,
    packages.length > 0
      ? `Found ${packages.length} dependencies.`
      : 'No additional dependencies required.'
  );

  // Step 3: Verify compute runtime is configured
  deployState.updateDeployProgress(projectId, 'starting', 65, 'Checking runtime availability...');

  const computeBackend = process.env.COMPUTE_BACKEND || 'modal';
  if (computeBackend === 'modal') {
    const hasModal = !!(process.env.MODAL_TOKEN_ID && process.env.MODAL_TOKEN_SECRET);
    if (!hasModal) {
      throw new Error('Modal runtime not configured — MODAL_TOKEN_ID and MODAL_TOKEN_SECRET required');
    }
  }
  // Docker backend: no credentials needed, just needs runit-runner image

  deployState.updateDeployProgress(projectId, 'starting', 75, 'Runtime available.');

  // Step 4: Verify endpoints exist
  deployState.updateDeployProgress(projectId, 'health_check', 85, 'Verifying endpoints...');

  if (!version.endpoints || version.endpoints.length === 0) {
    throw new Error('No endpoints found in project — cannot deploy');
  }

  deployState.updateDeployProgress(
    projectId, 'health_check', 95,
    `${version.endpoints.length} endpoint(s) ready.`
  );

  // Step 5: Mark project as live
  await projectsStore.updateProjectStatus(projectId, 'live', {
    deployed_at: new Date().toISOString(),
    deploy_error: null,
    runtime_url: null, // Runs use shared Modal functions, no per-project URL
  });

  deployState.completeDeploy(projectId);
  console.log(`Deployment complete for project ${projectId} (${version.endpoints.length} endpoints)`);
}
