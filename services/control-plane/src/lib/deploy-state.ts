// ABOUTME: In-memory deployment progress tracker with SSE subscriber support for real-time deploy status updates.
// ABOUTME: Manages deploy lifecycle (queued, building, installing, health_check, complete, failed) with auto-cleanup.
/**
 * Deploy State Management
 *
 * In-memory state for tracking deployment progress and SSE subscriptions.
 * IMPORTANT: This module is process-local. The control plane MUST run as a
 * single instance (no horizontal scaling) or deploy streams will silently
 * break. For multi-instance support, replace with Redis pub/sub.
 */

// Guard: warn at startup if hints suggest multi-instance deployment
if (process.env.INSTANCE_COUNT && parseInt(process.env.INSTANCE_COUNT) > 1) {
  console.error('[FATAL] deploy-state is in-memory only — INSTANCE_COUNT > 1 will break SSE deploy streams. Use Redis-backed state or run a single instance.');
}

export type DeployStep =
  | 'queued'
  | 'installing_deps'
  | 'building'
  | 'starting'
  | 'health_check'
  | 'complete'
  | 'failed';

export interface DeployState {
  projectId: string;
  step: DeployStep;
  progress: number; // 0-100
  message: string;
  error?: string;
  startedAt: Date;
  completedAt?: Date;
}

export interface DeployEvent {
  type: 'status' | 'complete' | 'error';
  step: DeployStep;
  progress: number;
  message: string;
  error?: string;
}

type Subscriber = (event: DeployEvent) => void;

// In-memory storage for deploy states
const deployStates = new Map<string, DeployState>();

// Subscribers for SSE connections
const subscribers = new Map<string, Set<Subscriber>>();

/**
 * Get current deploy state for a project
 */
export function getDeployState(projectId: string): DeployState | undefined {
  return deployStates.get(projectId);
}

/**
 * Initialize a new deployment
 */
export function initDeploy(projectId: string): DeployState {
  const state: DeployState = {
    projectId,
    step: 'queued',
    progress: 0,
    message: 'Deployment queued...',
    startedAt: new Date(),
  };
  deployStates.set(projectId, state);
  notifySubscribers(projectId, {
    type: 'status',
    step: state.step,
    progress: state.progress,
    message: state.message,
  });
  return state;
}

/**
 * Update deployment progress
 */
export function updateDeployProgress(
  projectId: string,
  step: DeployStep,
  progress: number,
  message: string
): void {
  const state = deployStates.get(projectId);
  if (!state) return;

  state.step = step;
  state.progress = progress;
  state.message = message;

  notifySubscribers(projectId, {
    type: 'status',
    step,
    progress,
    message,
  });
}

/**
 * Mark deployment as complete
 */
export function completeDeploy(projectId: string): void {
  const state = deployStates.get(projectId);
  if (!state) return;

  state.step = 'complete';
  state.progress = 100;
  state.message = 'Your app is live!';
  state.completedAt = new Date();

  notifySubscribers(projectId, {
    type: 'complete',
    step: 'complete',
    progress: 100,
    message: 'Your app is live!',
  });

  // Clean up after a delay to allow late subscribers to get final state
  setTimeout(() => {
    deployStates.delete(projectId);
    subscribers.delete(projectId);
  }, 60000);
}

/**
 * Mark deployment as failed
 */
export function failDeploy(projectId: string, error: string): void {
  const state = deployStates.get(projectId);
  if (!state) return;

  state.step = 'failed';
  state.error = error;
  state.completedAt = new Date();

  notifySubscribers(projectId, {
    type: 'error',
    step: 'failed',
    progress: state.progress,
    message: 'Something went wrong',
    error,
  });

  // Clean up after a delay
  setTimeout(() => {
    deployStates.delete(projectId);
    subscribers.delete(projectId);
  }, 60000);
}

/**
 * Subscribe to deploy events for a project
 */
export function subscribeToDeploy(projectId: string, callback: Subscriber): () => void {
  if (!subscribers.has(projectId)) {
    subscribers.set(projectId, new Set());
  }
  subscribers.get(projectId)!.add(callback);

  // Send current state immediately if deployment is in progress
  const state = deployStates.get(projectId);
  if (state) {
    callback({
      type: state.step === 'complete' ? 'complete' : state.step === 'failed' ? 'error' : 'status',
      step: state.step,
      progress: state.progress,
      message: state.message,
      error: state.error,
    });
  }

  // Return unsubscribe function
  return () => {
    const subs = subscribers.get(projectId);
    if (subs) {
      subs.delete(callback);
      if (subs.size === 0) {
        subscribers.delete(projectId);
      }
    }
  };
}

/**
 * Check if a deployment is in progress
 */
export function isDeploying(projectId: string): boolean {
  const state = deployStates.get(projectId);
  return !!state && state.step !== 'complete' && state.step !== 'failed';
}

/**
 * Notify all subscribers of a deploy event
 */
function notifySubscribers(projectId: string, event: DeployEvent): void {
  const subs = subscribers.get(projectId);
  if (subs) {
    for (const callback of subs) {
      try {
        callback(event);
      } catch (err) {
        console.error('Error in deploy subscriber:', err);
      }
    }
  }
}
