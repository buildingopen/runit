// ABOUTME: Hono routes for deploy/redeploy/status. Starts async deployment via deploy-bridge and streams progress via SSE.
// ABOUTME: Endpoints: POST deploy, POST redeploy, GET deploy/stream (SSE), GET deploy/status (polling).
/**
 * Deploy routes - Handle deployment workflow
 */

import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { getAuthContext } from '../middleware/auth.js';
import * as projectsStore from '../db/projects-store.js';
import * as deployState from '../lib/deploy-state.js';
import { runDeployment } from '../lib/deploy-bridge.js';

const deploy = new Hono();

/**
 * POST /projects/:id/deploy - Start deployment
 */
deploy.post('/:id/deploy', async (c) => {
  const projectId = c.req.param('id');

  // Require authenticated user
  const authContext = getAuthContext(c);
  if (!authContext.isAuthenticated || !authContext.user) {
    return c.json({ error: 'Authentication required' }, 401);
  }
  const userId = authContext.user.id;

  // Get project
  const project = await projectsStore.getProject(projectId);
  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  // Verify ownership
  if (project.owner_id !== userId) {
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

  // Start async deployment process (real Modal integration)
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

  // Require authenticated user and verify ownership
  const authContext = getAuthContext(c);
  if (!authContext.isAuthenticated || !authContext.user) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const project = await projectsStore.getProject(projectId);
  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  if (project.owner_id !== authContext.user.id) {
    return c.json({ error: 'Not authorized' }, 403);
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

  // Require authenticated user
  const authContext = getAuthContext(c);
  if (!authContext.isAuthenticated || !authContext.user) {
    return c.json({ error: 'Authentication required' }, 401);
  }
  const userId = authContext.user.id;

  // Get project
  const project = await projectsStore.getProject(projectId);
  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  // Verify ownership
  if (project.owner_id !== userId) {
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

  // Start async deployment process (real Modal integration)
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

  // Require authenticated user and verify ownership
  const authContext = getAuthContext(c);
  if (!authContext.isAuthenticated || !authContext.user) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const state = deployState.getDeployState(projectId);
  if (!state) {
    // Check database for status
    const project = await projectsStore.getProject(projectId);
    if (!project) {
      return c.json({ error: 'Project not found' }, 404);
    }

    if (project.owner_id !== authContext.user.id) {
      return c.json({ error: 'Not authorized' }, 403);
    }

    return c.json({
      status: project.status,
      deployed_at: project.deployed_at,
      deploy_error: project.deploy_error,
      runtime_url: project.runtime_url,
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

export default deploy;
