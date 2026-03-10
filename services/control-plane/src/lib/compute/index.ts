// ABOUTME: Factory for compute backends. Reads COMPUTE_BACKEND env var to select implementation.
// ABOUTME: Defaults to Docker for self-hosted; supports "modal" for cloud deployment.

import type { ComputeBackend } from './types.js';
import { ModalBackend } from './modal-backend.js';
import { DockerBackend } from './docker-backend.js';

let instance: ComputeBackend | null = null;

export function getComputeBackend(): ComputeBackend {
  if (instance) return instance;

  const backend = process.env.COMPUTE_BACKEND || 'docker';

  switch (backend) {
    case 'modal':
      instance = new ModalBackend();
      break;
    case 'docker':
    default:
      instance = new DockerBackend();
      break;
  }

  return instance;
}

export type { ComputeBackend, ExecutionRequest, ExecutionResult } from './types.js';
