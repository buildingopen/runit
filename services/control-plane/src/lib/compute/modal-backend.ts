// ABOUTME: Modal compute backend adapter - wraps executeOnModal() with ComputeBackend interface.
// ABOUTME: Default backend for production use.

import type { ComputeBackend, ExecutionRequest, ExecutionResult } from './types.js';
import { executeOnModal } from '../modal/client.js';

export class ModalBackend implements ComputeBackend {
  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    return executeOnModal({
      run_id: request.run_id,
      code_bundle: request.code_bundle,
      endpoint: request.endpoint,
      entrypoint: request.entrypoint,
      request_data: request.request_data,
      secrets_ref: request.secrets_ref,
      lane: request.lane,
      timeout_seconds: request.timeout_seconds,
      request_id: request.request_id,
    });
  }

  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    const hasModal = !!(process.env.MODAL_TOKEN_ID && process.env.MODAL_TOKEN_SECRET);
    return {
      healthy: hasModal,
      message: hasModal ? 'Modal credentials configured' : 'Modal credentials not configured',
    };
  }
}
