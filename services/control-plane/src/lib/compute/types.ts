// ABOUTME: ComputeBackend interface for abstracting execution providers (Modal, Docker, etc).
// ABOUTME: Defines ExecutionRequest/ExecutionResult types used across all compute backends.

export interface ExecutionRequest {
  run_id: string;
  code_bundle: string;
  endpoint: string;
  entrypoint?: string;
  request_data: {
    params?: Record<string, unknown>;
    json?: unknown;
    headers?: Record<string, string>;
    files?: Array<{ name: string; content: string; mime: string }>;
  };
  secrets_ref?: string;
  lane: 'cpu' | 'gpu';
  timeout_seconds: number;
  request_id?: string;
}

export interface Artifact {
  name: string;
  size: number;
  mime?: string;
  url?: string;
  data?: string;
}

export interface ExecutionResult {
  run_id: string;
  status: 'success' | 'error' | 'timeout';
  http_status: number;
  response_body: unknown;
  duration_ms: number;
  artifacts?: Artifact[];
  logs?: string;
  error_class?: string;
  error_message?: string;
  suggested_fix?: string;
}

export interface ComputeBackend {
  execute(request: ExecutionRequest): Promise<ExecutionResult>;
  healthCheck(): Promise<{ healthy: boolean; message?: string }>;
}
