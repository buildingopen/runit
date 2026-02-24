// ABOUTME: Factory for compute backends. Reads COMPUTE_BACKEND env var to select implementation.
// ABOUTME: Defaults to Modal; supports "docker" for local development.

import type { ComputeBackend } from './types.js';
import { ModalBackend } from './modal-backend.js';
import { DockerBackend } from './docker-backend.js';

let instance: ComputeBackend | null = null;

export function getComputeBackend(): ComputeBackend {
  if (instance) return instance;

  const backend = process.env.COMPUTE_BACKEND || 'modal';

  switch (backend) {
    case 'docker':
      instance = new DockerBackend();
      break;
    case 'modal':
    default:
      instance = new ModalBackend();
      break;
  }

  return instance;
}

export type { ComputeBackend, ExecutionRequest, ExecutionResult } from './types.js';
