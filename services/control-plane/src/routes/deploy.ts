/**
 * Deploy routes - Handle deployment workflow
 */

import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { getAuthContext } from '../middleware/auth.js';
import * as projectsStore from '../db/projects-store.js';
import * as deployState from '../lib/deploy-state.js';

const deploy = new Hono();

/**
 * POST /projects/:id/deploy - Start deployment
 */
deploy.post('/:id/deploy', async (c) => {
  const projectId = c.req.param('id');

  // Get authenticated user
  const authContext = getAuthContext(c);
  const userId = authContext.user?.id || 'anonymous';

  // Get project
  const project = await projectsStore.getProject(projectId);
  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  // Verify ownership
  if (project.owner_id !== userId && userId !== 'anonymous') {
    return c.json({ error: 'Not authorized' }, 403);
  }

  // Check if already deploying
  if (deployState.isDeploying(projectId)) {
    return c.json({ error: 'Deployment already in progress' }, 409);
  }

  // Check if project has a version
  const version = await projectsStore.getLatestVersion(projectId);
  if (!version) {
    return c.json({ error: 'No version available to deploy' }, 400);
  }

  // Initialize deployment
  deployState.initDeploy(projectId);

  // Update project status to deploying
  await projectsStore.updateProjectStatus(projectId, 'deploying', {
    deploy_error: null,
  });

  // Start async deployment process
  runDeployment(projectId, version).catch((err) => {
    console.error('Deployment failed:', err);
  });

  return c.json({
    status: 'deploying',
    streamUrl: `/projects/${projectId}/deploy/stream`,
  });
});

/**
 * GET /projects/:id/deploy/stream - SSE stream for deployment progress
 */
deploy.get('/:id/deploy/stream', async (c) => {
  const projectId = c.req.param('id');

  // Get project to verify it exists
  const project = await projectsStore.getProject(projectId);
  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  // Set up SSE stream
  return streamSSE(c, async (stream) => {
    let unsubscribe: (() => void) | null = null;

    try {
      // Send initial connection event
      await stream.writeSSE({
        event: 'connected',
        data: JSON.stringify({ projectId }),
      });

      // Subscribe to deploy events
      unsubscribe = deployState.subscribeToDeploy(projectId, async (event) => {
        try {
          await stream.writeSSE({
            event: event.type,
            data: JSON.stringify(event),
          });

          // Close stream on complete or error
          if (event.type === 'complete' || event.type === 'error') {
            setTimeout(() => {
              stream.close();
            }, 100);
          }
        } catch (err) {
          console.error('Error writing SSE:', err);
        }
      });

      // Keep connection alive with heartbeat
      const heartbeat = setInterval(async () => {
        try {
          await stream.writeSSE({
            event: 'heartbeat',
            data: JSON.stringify({ time: Date.now() }),
          });
        } catch {
          clearInterval(heartbeat);
        }
      }, 15000);

      // Wait for abort signal
      await new Promise<void>((resolve) => {
        c.req.raw.signal.addEventListener('abort', () => {
          clearInterval(heartbeat);
          resolve();
        });
      });
    } finally {
      if (unsubscribe) {
        unsubscribe();
      }
    }
  });
});

/**
 * POST /projects/:id/redeploy - Redeploy with latest code
 */
deploy.post('/:id/redeploy', async (c) => {
  const projectId = c.req.param('id');

  // Get authenticated user
  const authContext = getAuthContext(c);
  const userId = authContext.user?.id || 'anonymous';

  // Get project
  const project = await projectsStore.getProject(projectId);
  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  // Verify ownership
  if (project.owner_id !== userId && userId !== 'anonymous') {
    return c.json({ error: 'Not authorized' }, 403);
  }

  // Check if already deploying
  if (deployState.isDeploying(projectId)) {
    return c.json({ error: 'Deployment already in progress' }, 409);
  }

  // Get latest version
  const version = await projectsStore.getLatestVersion(projectId);
  if (!version) {
    return c.json({ error: 'No version available to deploy' }, 400);
  }

  // Initialize deployment
  deployState.initDeploy(projectId);

  // Update project status to deploying
  await projectsStore.updateProjectStatus(projectId, 'deploying', {
    deploy_error: null,
  });

  // Start async deployment process
  runDeployment(projectId, version).catch((err) => {
    console.error('Redeploy failed:', err);
  });

  return c.json({
    status: 'deploying',
    streamUrl: `/projects/${projectId}/deploy/stream`,
  });
});

/**
 * GET /projects/:id/deploy/status - Get current deploy status (non-SSE)
 */
deploy.get('/:id/deploy/status', async (c) => {
  const projectId = c.req.param('id');

  const state = deployState.getDeployState(projectId);
  if (!state) {
    // Check database for status
    const project = await projectsStore.getProject(projectId);
    if (!project) {
      return c.json({ error: 'Project not found' }, 404);
    }

    return c.json({
      status: project.status,
      deployed_at: project.deployed_at,
      deploy_error: project.deploy_error,
    });
  }

  return c.json({
    status: state.step === 'complete' ? 'live' : state.step === 'failed' ? 'failed' : 'deploying',
    step: state.step,
    progress: state.progress,
    message: state.message,
    error: state.error,
  });
});

/**
 * Run the actual deployment process
 * This is a simulation - in production this would:
 * 1. Install dependencies on Modal
 * 2. Build the container
 * 3. Start the sandbox
 * 4. Run health checks
 */
async function runDeployment(
  projectId: string,
  version: projectsStore.ProjectVersion
): Promise<void> {
  try {
    // Step 1: Installing dependencies (simulated)
    deployState.updateDeployProgress(projectId, 'installing_deps', 10, 'Installing dependencies...');
    await sleep(1500);

    deployState.updateDeployProgress(projectId, 'installing_deps', 25, 'Resolving packages...');
    await sleep(1000);

    // Step 2: Building
    deployState.updateDeployProgress(projectId, 'building', 40, 'Building container...');
    await sleep(1500);

    deployState.updateDeployProgress(projectId, 'building', 55, 'Optimizing build...');
    await sleep(1000);

    // Step 3: Starting
    deployState.updateDeployProgress(projectId, 'starting', 70, 'Starting sandbox...');
    await sleep(1500);

    // Step 4: Health check
    deployState.updateDeployProgress(projectId, 'health_check', 85, 'Running health check...');
    await sleep(1000);

    deployState.updateDeployProgress(projectId, 'health_check', 95, 'Verifying endpoints...');
    await sleep(500);

    // Complete
    deployState.completeDeploy(projectId);

    // Update project status
    await projectsStore.updateProjectStatus(projectId, 'live', {
      deployed_at: new Date().toISOString(),
      deploy_error: null,
      runtime_url: `https://${projectId}.runtime.ai`, // Placeholder URL
    });

    console.log(`✅ Deployment complete for project ${projectId}`);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    deployState.failDeploy(projectId, errorMessage);

    await projectsStore.updateProjectStatus(projectId, 'failed', {
      deploy_error: errorMessage,
    });

    console.error(`❌ Deployment failed for project ${projectId}:`, err);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default deploy;
