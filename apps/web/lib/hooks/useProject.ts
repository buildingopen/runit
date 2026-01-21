/**
 * React Query hooks for project, endpoints, and runs
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';

/**
 * Fetch a single project by ID
 */
export function useProject(projectId: string | null) {
  return useQuery({
    queryKey: ['project', projectId],
    queryFn: () => apiClient.getProject(projectId!),
    enabled: !!projectId,
    retry: (failureCount, error) => {
      // Don't retry on 404 or other client errors
      if (error instanceof Error && (error.message.includes('404') || error.message.includes('not found'))) {
        return false;
      }
      return failureCount < 2;
    },
  });
}

/**
 * Fetch endpoints for a project version
 */
export function useEndpoints(projectId: string | null, versionId?: string) {
  return useQuery({
    queryKey: ['endpoints', projectId, versionId],
    queryFn: () => apiClient.getEndpoints(projectId!, versionId),
    enabled: !!projectId,
  });
}

/**
 * Fetch endpoint schema
 */
export function useEndpointSchema(
  projectId: string | null,
  versionId: string | null,
  endpointId: string | null
) {
  return useQuery({
    queryKey: ['schema', projectId, versionId, endpointId],
    queryFn: () => apiClient.getEndpointSchema(projectId!, versionId!, endpointId!),
    enabled: !!projectId && !!versionId && !!endpointId,
  });
}

/**
 * Create a run (mutation)
 */
export function useCreateRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Parameters<typeof apiClient.createRun>[0]) =>
      apiClient.createRun(data),
    onSuccess: (data, variables) => {
      // Invalidate runs list for this project
      queryClient.invalidateQueries({
        queryKey: ['runs', variables.project_id],
      });
    },
  });
}

/**
 * Fetch run status with automatic polling
 */
export function useRunStatus(runId: string | null) {
  return useQuery({
    queryKey: ['run', runId],
    queryFn: () => apiClient.getRunStatus(runId!),
    enabled: !!runId,
    refetchInterval: (query) => {
      const data = query.state.data;
      // Poll while running
      if (data?.status === 'running' || data?.status === 'queued') {
        return 1000; // 1 second
      }
      return false; // Stop polling
    },
  });
}

/**
 * Fetch runs list for a project
 */
export function useRunsList(projectId: string | null, limit?: number) {
  return useQuery({
    queryKey: ['runs', projectId, limit],
    queryFn: () => apiClient.listRuns(projectId!, limit),
    enabled: !!projectId,
  });
}

/**
 * Fetch share links for a project
 */
export function useShareLinks(projectId: string | null) {
  return useQuery({
    queryKey: ['shares', projectId],
    queryFn: () => apiClient.listShareLinks(projectId!),
    enabled: !!projectId,
  });
}

/**
 * Create share link mutation
 */
export function useCreateShareLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      projectId: string;
      target_type: 'endpoint_template' | 'run_result';
      target_ref: string;
    }) => apiClient.createShareLink(data.projectId, {
      target_type: data.target_type,
      target_ref: data.target_ref,
    }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['shares', variables.projectId],
      });
    },
  });
}

/**
 * Disable share link mutation
 */
export function useDisableShareLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { projectId: string; shareId: string }) =>
      apiClient.disableShareLink(data.projectId, data.shareId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['shares', variables.projectId],
      });
    },
  });
}
