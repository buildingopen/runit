/**
 * API Client for Execution Layer Control Plane
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface Project {
  project_id: string;
  project_slug: string;
  name: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
  versions: ProjectVersion[];
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
  source_type: 'zip';
  zip_data: string;
}

export interface CreateProjectResponse {
  project_id: string;
  project_slug: string;
  version_id: string;
  version_hash: string;
  status: string;
}

class APIClient {
  private baseURL: string;

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  async request<T>(path: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseURL}${path}`;

    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
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

  // Create project
  async createProject(data: CreateProjectRequest) {
    return this.request<CreateProjectResponse>('/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Get endpoints for a project version
  async getEndpoints(projectId: string, versionId?: string) {
    const params = versionId ? `?version_id=${versionId}` : '';
    return this.request<{
      endpoints: Array<{
        id: string;
        method: string;
        path: string;
        summary?: string;
        description?: string;
        requires_gpu?: boolean;
      }>;
    }>(`/projects/${projectId}/endpoints${params}`);
  }

  // Get endpoint schema
  async getEndpointSchema(projectId: string, versionId: string, endpointId: string) {
    return this.request<{
      endpoint: {
        id: string;
        method: string;
        path: string;
        summary?: string;
        description?: string;
      };
      schema: any;
    }>(`/projects/${projectId}/versions/${versionId}/endpoints/${endpointId}/schema`);
  }

  // Create a run
  async createRun(data: {
    project_id: string;
    version_id: string;
    endpoint_id: string;
    request_data: {
      params?: Record<string, any>;
      json?: any;
      headers?: Record<string, string>;
      files?: Array<{ name: string; content: string; mime: string }>;
    };
    lane?: 'cpu' | 'gpu';
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
      status: 'success' | 'error' | 'timeout' | 'running' | 'queued';
      duration_ms?: number;
      http_status?: number;
      response_body?: any;
      artifacts?: Array<{
        name: string;
        size: number;
        mime: string;
        url: string;
      }>;
      error_class?: string;
      error_message?: string;
      suggested_fix?: string;
    }>(`/runs/${runId}`);
  }

  // List runs for a project
  async listRuns(projectId: string, limit: number = 20) {
    return this.request<{
      runs: Array<{
        run_id: string;
        endpoint: string;
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
}

export const apiClient = new APIClient();
