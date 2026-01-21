// ABOUTME: React Query hook for run execution with automatic status polling
// ABOUTME: Handles create run, poll status, and update run history

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateRunRequest,
  CreateRunResponse,
  GetRunStatusResponse,
} from '@execution-layer/shared';
import { createRun, getRunStatus } from '../api/run-api';

/**
 * Hook for executing runs
 */
export function useRunExecution() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (req: CreateRunRequest) => {
      return createRun(req);
    },
    onSuccess: (data) => {
      // Invalidate runs list to update history
      queryClient.invalidateQueries({ queryKey: ['runs'] });

      // If result is immediate, invalidate run status
      if (data.result) {
        queryClient.setQueryData(['run', data.run_id], {
          run_id: data.run_id,
          status: data.status,
          result: data.result,
        });
      }
    },
  });
}

/**
 * Hook for polling run status
 */
export function useRunStatus(runId: string | null, enabled = true) {
  return useQuery({
    queryKey: ['run', runId],
    queryFn: async () => {
      if (!runId) throw new Error('No run ID provided');
      return getRunStatus({ run_id: runId });
    },
    enabled: enabled && !!runId,
    refetchInterval: (query) => {
      // Poll every 1s while running, stop when complete
      if (!query.state.data) return 1000;
      const status = query.state.data.status;
      if (status === 'queued' || status === 'running') {
        return 1000;
      }
      return false;
    },
  });
}

/**
 * Hook for listing runs
 */
export function useRunsList(projectId: string, endpointId?: string) {
  return useQuery({
    queryKey: ['runs', projectId, endpointId],
    queryFn: async () => {
      const { listRuns } = await import('../api/run-api');
      return listRuns({
        project_id: projectId,
        endpoint_id: endpointId,
        limit: 20,
      });
    },
  });
}

/**
 * Hook for listing endpoints
 */
export function useEndpoints(projectId: string, versionId?: string) {
  return useQuery({
    queryKey: ['endpoints', projectId, versionId],
    queryFn: async () => {
      const { listEndpoints } = await import('../api/run-api');
      return listEndpoints({
        project_id: projectId,
        version_id: versionId,
      });
    },
  });
}

/**
 * Hook for getting endpoint schema
 */
export function useEndpointSchema(
  projectId: string,
  versionId: string,
  endpointId: string | null
) {
  return useQuery({
    queryKey: ['endpoint-schema', projectId, versionId, endpointId],
    queryFn: async () => {
      if (!endpointId) throw new Error('No endpoint ID provided');
      const { getEndpointSchema } = await import('../api/run-api');
      return getEndpointSchema({
        project_id: projectId,
        version_id: versionId,
        endpoint_id: endpointId,
      });
    },
    enabled: !!endpointId,
  });
}
