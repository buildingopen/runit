// ABOUTME: Hono routes for deploy/redeploy/status. Starts async deployment via deploy-bridge and streams progress via SSE.
// ABOUTME: Endpoints: POST deploy, POST redeploy, GET deploy/stream (SSE), GET deploy/status (polling).
/**
 * Deploy routes - Handle deployment workflow
 */

import { Hono } from 'hono';
import { createHmac } from 'crypto';
import { streamSSE } from 'hono/streaming';
import { getAuthContext, type AuthContext } from '../middleware/auth.js';
import * as projectsStore from '../db/projects-store.js';
import * as deployState from '../lib/deploy-state.js';
import { runDeployment } from '../lib/deploy-bridge.js';

// ---------------------------------------------------------------------------
// Scoped stream tokens — short-lived HMAC-signed tokens for SSE endpoints.
// Avoids sending the full session JWT in the URL (which leaks in logs/history).
// ---------------------------------------------------------------------------

const STREAM_TOKEN_TTL_SECONDS = 60;

function getSigningKey(): string {
  // Use dedicated signing key; fall back to derived key from master (never share raw master key)
  if (process.env.STREAM_TOKEN_SECRET) return process.env.STREAM_TOKEN_SECRET;
  if (process.env.MASTER_ENCRYPTION_KEY) return `stream:${process.env.MASTER_ENCRYPTION_KEY}`;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('STREAM_TOKEN_SECRET or MASTER_ENCRYPTION_KEY must be set in production');
  }
  return 'dev-stream-token-key';
}

/** Create a scoped, short-lived stream token for a specific project + user. */
export function createStreamToken(projectId: string, userId: string): string {
  const exp = Math.floor(Date.now() / 1000) + STREAM_TOKEN_TTL_SECONDS;
  const payload = JSON.stringify({ pid: projectId, uid: userId, exp });
  const sig = createHmac('sha256', getSigningKey()).update(payload).digest('base64url');
  return Buffer.from(payload).toString('base64url') + '.' + sig;
}

/** Verify a scoped stream token. Returns project/user IDs or null. */
function verifyStreamToken(token: string): { projectId: string; userId: string } | null {
  const dotIdx = token.indexOf('.');
  if (dotIdx < 0) return null;

  const payloadB64 = token.substring(0, dotIdx);
  const sig = token.substring(dotIdx + 1);

  try {
    const payloadStr = Buffer.from(payloadB64, 'base64url').toString();
    const expectedSig = createHmac('sha256', getSigningKey()).update(payloadStr).digest('base64url');
    if (sig !== expectedSig) return null;

    const payload = JSON.parse(payloadStr);
    if (!payload.pid || !payload.uid || !payload.exp) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;

    return { projectId: payload.pid, userId: payload.uid };
  } catch {
    return null;
  }
}

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
    streamUrl: `${c.req.path.startsWith('/v1/') ? '/v1' : ''}/projects/${projectId}/deploy/stream`,
  });
});

/**
 * POST /projects/:id/deploy/stream-token - Get a short-lived scoped token for the SSE stream.
 * This avoids sending the full session JWT in the EventSource URL.
 */
deploy.post('/:id/deploy/stream-token', async (c) => {
  const projectId = c.req.param('id');

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

  const token = createStreamToken(projectId, authContext.user.id);
  return c.json({ token, expires_in: STREAM_TOKEN_TTL_SECONDS });
});

/**
 * GET /projects/:id/deploy/stream - SSE stream for deployment progress.
 * Accepts ?token= with a scoped stream token (from POST .../stream-token).
 */
deploy.get('/:id/deploy/stream', async (c) => {
  const projectId = c.req.param('id');

  // Verify scoped stream token from query param
  const queryToken = c.req.query('token');
  if (!queryToken) {
    return c.json({ error: 'Stream token required. Call POST .../stream-token first.' }, 401);
  }

  const tokenData = verifyStreamToken(queryToken);
  if (!tokenData) {
    return c.json({ error: 'Invalid or expired stream token' }, 401);
  }

  // Verify token is scoped to this project
  if (tokenData.projectId !== projectId) {
    return c.json({ error: 'Token not valid for this project' }, 403);
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
    streamUrl: `${c.req.path.startsWith('/v1/') ? '/v1' : ''}/projects/${projectId}/deploy/stream`,
  });
});

/**
 * GET /projects/:id/deploy/status - Get current deploy status (non-SSE)
 */
deploy.get('/:id/deploy/status', async (c) => {
  const projectId = c.req.param('id');

  // Require authenticated user
  const authContext = getAuthContext(c);
  if (!authContext.isAuthenticated || !authContext.user) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  // Always verify ownership via DB (before returning any state)
  const project = await projectsStore.getProject(projectId);
  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }
  if (project.owner_id !== authContext.user.id) {
    return c.json({ error: 'Not authorized' }, 403);
  }

  // Check in-memory deploy state first (active deployments)
  const state = deployState.getDeployState(projectId);
  if (state) {
    return c.json({
      status: state.step === 'complete' ? 'live' : state.step === 'failed' ? 'failed' : 'deploying',
      step: state.step,
      progress: state.progress,
      message: state.message,
      error: state.error,
    });
  }

  // Fall back to DB status
  return c.json({
    status: project.status,
    deployed_at: project.deployed_at,
    deploy_error: project.deploy_error,
    runtime_url: project.runtime_url,
  });
});

export default deploy;
