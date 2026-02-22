/**
 * API Client for Runtime Control Plane
 */

import { createBrowserClient } from '@supabase/ssr';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

if (!API_BASE_URL && typeof window !== 'undefined') {
  console.error('NEXT_PUBLIC_API_URL is not configured');
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Get the current user's access token from Supabase.
 * Returns null if not authenticated.
 */
async function getAccessToken(): Promise<string | null> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return null;
  }

  try {
    const supabase = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error || !session) {
      return null;
    }

    // Check if token is close to expiry (< 60s) and refresh
    const expiresAt = session.expires_at;
    if (expiresAt && expiresAt * 1000 - Date.now() < 60000) {
      const { data: refreshed } = await supabase.auth.refreshSession();
      return refreshed.session?.access_token || session.access_token;
    }

    return session.access_token;
  } catch {
    return null;
  }
}

export type ProjectStatus = 'draft' | 'deploying' | 'live' | 'failed';

export interface Project {
  project_id: string;
  project_slug: string;
  name: string;
  owner_id: string;
  status: ProjectStatus;
  deployed_at?: string | null;
  deploy_error?: string | null;
  runtime_url?: string | null;
  description?: string | null;
  tags?: string[];
  detected_env_vars?: string[];
  created_at: string;
  updated_at: string;
  endpoints?: Array<{ id: string; method: string; path: string; summary?: string }>;
  versions?: ProjectVersion[];
  latest_version?: string;
}

export interface ProjectVersion {
  version_id: string;
  version_hash: string;
  code_bundle: string;
  created_at: string;
  status: 'ready' | 'failed';
}

export interface CreateProjectRequest {
  name: string;
  source_type: 'zip' | 'github';
  zip_data?: string;
  github_url?: string;
  github_ref?: string;
}

export interface CreateProjectResponse {
  project_id: string;
  project_slug: string;
  version_id: string;
  version_hash: string;
  status: ProjectStatus;
  detected_env_vars: string[];
  endpoints: Array<{ id: string; method: string; path: string; summary?: string }>;
}

class APIClient {
  private baseURL: string;

  constructor(baseURL?: string) {
    this.baseURL = baseURL || API_BASE_URL || '';
  }

  async request<T>(path: string, options?: RequestInit & { timeout?: number }): Promise<T> {
    if (!this.baseURL) {
      throw new Error('API URL is not configured. Set NEXT_PUBLIC_API_URL environment variable.');
    }

    const url = `${this.baseURL}${path}`;

    const controller = new AbortController();
    const timeoutMs = options?.timeout || 10000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    // Get auth token
    const token = await getAccessToken();

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...options?.headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      return response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout - API took too long to respond');
      }
      throw error;
    }
  }

  // Health check
  async health() {
    return this.request<{ status: string }>('/health');
  }

  // Get API info
  async getInfo() {
    return this.request<{
      name: string;
      version: string;
      status: string;
      features: string[];
    }>('/');
  }

  // List projects
  async listProjects() {
    return this.request<{ projects: Project[] }>('/projects');
  }

  // Get project by ID
  async getProject(projectId: string) {
    return this.request<Project>(`/projects/${projectId}`);
  }

  // Create project (longer timeout for GitHub cloning)
  async createProject(data: CreateProjectRequest) {
    return this.request<CreateProjectResponse>('/projects', {
      method: 'POST',
      body: JSON.stringify(data),
      timeout: 120000,
    });
  }

  // Get endpoints for a project version
  async getEndpoints(projectId: string, versionId?: string) {
    const params = versionId ? `?version_id=${versionId}` : '';
    return this.request<{
      endpoints: Array<{
        endpoint_id: string;
        method: string;
        path: string;
        summary?: string;
        description?: string;
        requires_gpu?: boolean;
        schema_ref?: string;
      }>;
    }>(`/projects/${projectId}/endpoints${params}`);
  }

  // Get endpoint schema
  async getEndpointSchema(projectId: string, versionId: string, endpointId: string) {
    const response = await this.request<{
      endpoint_id: string;
      method: string;
      path: string;
      summary?: string;
      description?: string;
      request_schema?: any;
      response_schema?: any;
      parameters?: any[];
    }>(`/projects/${projectId}/versions/${versionId}/endpoints/${endpointId}/schema`);

    return {
      endpoint: {
        id: response.endpoint_id,
        method: response.method,
        path: response.path,
        summary: response.summary,
        description: response.description,
      },
      schema: response.request_schema,
      parameters: response.parameters,
    };
  }

  // Create a run
  async createRun(data: {
    project_id: string;
    version_id: string;
    endpoint_id: string;
    params?: Record<string, any>;
    json?: any;
    headers?: Record<string, string>;
    files?: Array<{ filename: string; data: string; content_type: string }>;
    lane?: 'cpu' | 'gpu';
    timeout_seconds?: number;
  }) {
    return this.request<{
      run_id: string;
      status: string;
    }>('/runs', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Get run status
  async getRunStatus(runId: string) {
    return this.request<{
      run_id: string;
      project_id: string;
      version_id: string;
      endpoint_id: string;
      status: 'success' | 'error' | 'timeout' | 'running' | 'queued';
      created_at: string;
      started_at?: string;
      completed_at?: string;
      duration_ms?: number;
      created_by: string;
      result?: {
        http_status: number;
        content_type: string;
        json?: any;
        artifacts: Array<{
          name: string;
          size: number;
          mime_type: string;
          download_url: string;
        }>;
        redactions_applied: boolean;
        error_class?: string | null;
        error_message?: string | null;
        suggested_fix?: string | null;
      };
    }>(`/runs/${runId}`);
  }

  // List runs for a project
  async listRuns(projectId: string, limit: number = 20) {
    return this.request<{
      runs: Array<{
        run_id: string;
        endpoint_id: string;
        status: string;
        created_at: string;
        duration_ms?: number;
      }>;
    }>(`/projects/${projectId}/runs?limit=${limit}`);
  }

  // Create share link
  async createShareLink(projectId: string, data: {
    target_type: 'endpoint_template' | 'run_result';
    target_ref: string;
  }) {
    return this.request<{
      share_id: string;
      share_url: string;
      target_type: string;
      target_ref: string;
    }>(`/projects/${projectId}/share`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // List share links for a project
  async listShareLinks(projectId: string) {
    return this.request<{
      shares: Array<{
        share_id: string;
        share_url: string;
        target_type: string;
        target_ref: string;
        enabled: boolean;
        created_at: string;
        stats: {
          run_count: number;
          success_count: number;
          last_run_at?: string;
        };
      }>;
      total: number;
    }>(`/projects/${projectId}/shares`);
  }

  // Disable share link
  async disableShareLink(projectId: string, shareId: string) {
    return this.request<{
      share_id: string;
      status: string;
    }>(`/projects/${projectId}/share/${shareId}`, {
      method: 'DELETE',
    });
  }

  // Get share link data
  async getShareLink(shareId: string) {
    return this.request<{
      share_id: string;
      project: {
        project_id: string;
        name: string;
      };
      target_type: string;
      target_ref: string;
      stats: {
        run_count: number;
        success_count: number;
        last_run_at?: string;
      };
    }>(`/share/${shareId}`);
  }

  // Delete project
  async deleteProject(projectId: string) {
    return this.request<{ status: string }>(`/projects/${projectId}`, {
      method: 'DELETE',
    });
  }

  // Update project
  async updateProject(projectId: string, data: { name?: string; slug?: string }) {
    return this.request<Project>(`/projects/${projectId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // Set secrets for a project
  async setSecrets(projectId: string, secrets: Array<{ key: string; value: string }>) {
    await Promise.all(
      secrets.map((secret) =>
        this.request(`/projects/${projectId}/secrets`, {
          method: 'POST',
          body: JSON.stringify({ key: secret.key, value: secret.value }),
        })
      )
    );
    return { status: 'ok' };
  }

  // Start deployment
  async startDeploy(projectId: string) {
    return this.request<{
      status: string;
      streamUrl: string;
    }>(`/projects/${projectId}/deploy`, {
      method: 'POST',
      timeout: 30000,
    });
  }

  // Get deploy status (non-SSE)
  async getDeployStatus(projectId: string) {
    return this.request<{
      status: ProjectStatus;
      step?: string;
      progress?: number;
      message?: string;
      error?: string;
      deployed_at?: string;
      deploy_error?: string;
      runtime_url?: string;
    }>(`/projects/${projectId}/deploy/status`);
  }

  // Redeploy project
  async redeploy(projectId: string) {
    return this.request<{
      status: string;
      streamUrl: string;
    }>(`/projects/${projectId}/redeploy`, {
      method: 'POST',
      timeout: 30000,
    });
  }

  // Create EventSource for deploy streaming
  createDeployStream(projectId: string): EventSource {
    if (!this.baseURL) {
      throw new Error('API URL is not configured');
    }
    const url = `${this.baseURL}/projects/${projectId}/deploy/stream`;
    return new EventSource(url);
  }
}

export const apiClient = new APIClient();
