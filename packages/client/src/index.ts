// ABOUTME: HTTP client for the RunIt control plane API. Shared by @runit/cli and @runit/mcp-server.
// ABOUTME: Handles auth (Bearer token), base URL, and typed responses for all API endpoints.

export interface RunitConfig {
  baseUrl: string;
  apiKey?: string;
}

export interface DeployResponse {
  url: string | null;
  project_id: string;
  project_slug: string;
  version_id: string;
  version_hash: string;
  status: string;
  share_id: string | null;
  endpoints: Array<{ id: string; method: string; path: string; summary?: string }>;
  detected_env_vars: string[];
}

export interface Project {
  project_id: string;
  project_slug: string;
  name: string;
  status?: string;
  latest_version?: string;
  created_at: string;
  updated_at: string;
}

export interface RunResponse {
  run_id: string;
  status: string;
}

export interface RunStatus {
  run_id: string;
  project_id: string;
  version_id: string;
  endpoint_id: string;
  status: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  result?: {
    http_status: number;
    content_type: string;
    json?: unknown;
    error_class?: string;
    error_message?: string;
    suggested_fix?: string;
    logs?: string;
  };
}

export interface SecretEntry {
  key: string;
  created_at: string;
  updated_at: string;
}

export interface StorageEntry {
  key: string;
  value_type: 'json' | 'binary';
  size_bytes: number;
  created_at: string;
  updated_at: string;
}

export interface StorageValue extends StorageEntry {
  value: unknown;
}

export interface ContextEntry {
  id: string;
  project_id: string;
  name: string | null;
  url: string;
  data: Record<string, unknown>;
  size_bytes: number;
  fetched_at: string;
  created_at: string;
  updated_at: string;
}

export interface ShareLink {
  share_id: string;
  share_url: string;
  target_type: 'endpoint_template' | 'run_result';
  target_ref: string;
  enabled: boolean;
  created_at: string;
  expires_at: string | null;
  stats: {
    run_count: number;
    success_count: number;
    last_run_at: string | null;
  };
}

export class RunitClient {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(config: RunitConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.headers = {
      'Content-Type': 'application/json',
    };
    if (config.apiKey) {
      this.headers['Authorization'] = `Bearer ${config.apiKey}`;
    }
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}/v1${path}`;
    const res = await fetch(url, {
      method,
      headers: this.headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await res.json() as T & { error?: string };
    if (!res.ok) {
      throw new Error(data.error || `HTTP ${res.status}: ${res.statusText}`);
    }
    return data;
  }

  async deploy(code: string, name: string, requirements?: string[], config?: Record<string, unknown>): Promise<DeployResponse> {
    const body: Record<string, unknown> = { code, name };
    if (requirements) body.requirements = requirements;
    if (config) body.config = config;
    return this.request<DeployResponse>('POST', '/deploy', body);
  }

  async listProjects(): Promise<{ projects: Project[]; total: number }> {
    return this.request('GET', '/projects');
  }

  async getProject(projectId: string): Promise<Project & { endpoints?: Array<{ id: string; method: string; path: string; summary?: string; description?: string; requestBody?: Record<string, unknown>; responses?: Record<string, unknown> }> }> {
    return this.request('GET', `/projects/${projectId}`);
  }

  async deleteProject(projectId: string): Promise<{ success: boolean }> {
    return this.request('DELETE', `/projects/${projectId}`);
  }

  async run(projectId: string, versionId: string, endpointId: string, params?: {
    json?: unknown;
    params?: Record<string, unknown>;
    lane?: 'cpu' | 'gpu';
    timeout_seconds?: number;
  }): Promise<RunResponse> {
    return this.request<RunResponse>('POST', '/runs', {
      project_id: projectId,
      version_id: versionId,
      endpoint_id: endpointId,
      ...params,
    });
  }

  async getRunStatus(runId: string): Promise<RunStatus> {
    return this.request('GET', `/runs/${runId}`);
  }

  async waitForRun(runId: string, timeoutMs: number = 120000): Promise<RunStatus> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const status = await this.getRunStatus(runId);
      if (status.status === 'success' || status.status === 'error' || status.status === 'timeout') {
        return status;
      }
      await new Promise(r => setTimeout(r, 1000));
    }
    throw new Error(`Run ${runId} timed out after ${timeoutMs}ms`);
  }

  async listSecrets(projectId: string): Promise<{ secrets: SecretEntry[] }> {
    return this.request('GET', `/projects/${projectId}/secrets`);
  }

  async setSecret(projectId: string, key: string, value: string): Promise<{ key: string }> {
    return this.request('POST', `/projects/${projectId}/secrets`, { key, value });
  }

  async deleteSecret(projectId: string, key: string): Promise<{ deleted: boolean }> {
    return this.request('DELETE', `/projects/${projectId}/secrets/${key}`);
  }

  async getProjectRuns(projectId: string, limit: number = 20): Promise<{ runs: Array<{ run_id: string; endpoint_id: string; status: string; created_at: string; duration_ms?: number }> }> {
    return this.request('GET', `/projects/${projectId}/runs?limit=${limit}`);
  }

  async listVersions(projectId: string): Promise<{
    versions: Array<{
      version_id: string;
      version_hash: string;
      created_at: string;
      status: string;
      is_dev: boolean;
      is_prod: boolean;
      endpoints: Array<{ id: string; method: string; path: string; summary?: string }>;
    }>;
    total: number;
    dev_version_id: string | null;
    prod_version_id: string | null;
  }> {
    return this.request('GET', `/projects/${projectId}/versions`);
  }

  async promote(projectId: string, versionId?: string): Promise<{
    promoted: boolean;
    rolled_back?: boolean;
    reason?: string;
    version_id: string;
    version_hash?: string;
    previous_version_id?: string | null;
  }> {
    const body: Record<string, unknown> = {};
    if (versionId) body.version_id = versionId;
    return this.request('POST', `/projects/${projectId}/promote`, body);
  }

  async rollback(projectId: string, versionId: string): Promise<{
    rolled_back: boolean;
    version_id: string;
    version_hash: string;
    previous_version_id: string | null;
  }> {
    return this.request('POST', `/projects/${projectId}/rollback`, { version_id: versionId });
  }

  async putStorage(projectId: string, key: string, value: unknown, valueType: 'json' | 'binary' = 'json'): Promise<StorageEntry> {
    return this.request('PUT', `/projects/${projectId}/storage/${encodeURIComponent(key)}`, { value, value_type: valueType });
  }

  async getStorage(projectId: string, key: string): Promise<StorageValue> {
    return this.request('GET', `/projects/${projectId}/storage/${encodeURIComponent(key)}`);
  }

  async deleteStorage(projectId: string, key: string): Promise<{ success: boolean }> {
    return this.request('DELETE', `/projects/${projectId}/storage/${encodeURIComponent(key)}`);
  }

  async listStorage(projectId: string): Promise<{ entries: StorageEntry[]; total: number; usage_bytes: number; quota_bytes: number }> {
    return this.request('GET', `/projects/${projectId}/storage`);
  }

  async createShareLink(projectId: string, targetType: 'endpoint_template' | 'run_result', targetRef: string): Promise<{ share_id: string; share_url: string }> {
    return this.request('POST', `/projects/${projectId}/share`, { target_type: targetType, target_ref: targetRef });
  }

  async listShareLinks(projectId: string): Promise<{ shares: ShareLink[]; total: number }> {
    return this.request('GET', `/projects/${projectId}/shares`);
  }

  async disableShareLink(projectId: string, shareId: string): Promise<{ share_id: string; status: string }> {
    return this.request('DELETE', `/projects/${projectId}/share/${shareId}`);
  }

  async getShareLink(shareId: string): Promise<{ share_id: string; project: { project_id: string; name: string }; version_id: string; target_type: string; target_ref: string }> {
    return this.request('GET', `/share/${shareId}`);
  }

  async fetchContext(projectId: string, url: string, name: string): Promise<{ id: string; data: Record<string, unknown> }> {
    return this.request('POST', `/projects/${projectId}/context`, { url, name });
  }

  async listContexts(projectId: string): Promise<{ contexts: Array<{ id: string; name: string | null; url: string; created_at: string; updated_at: string; fetched_at: string; size: number }> }> {
    return this.request('GET', `/projects/${projectId}/context`);
  }

  async deleteContext(projectId: string, contextId: string): Promise<{ success: boolean }> {
    return this.request('DELETE', `/projects/${projectId}/context/${contextId}`);
  }

  async health(): Promise<{ status: string; tunnel_url?: string }> {
    const url = `${this.baseUrl}/health`;
    const res = await fetch(url, { headers: this.headers });
    return res.json() as Promise<{ status: string; tunnel_url?: string }>;
  }
}
