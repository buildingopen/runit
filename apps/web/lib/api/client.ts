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
}

export const apiClient = new APIClient();
