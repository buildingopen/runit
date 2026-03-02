import posthog from 'posthog-js';

export function trackProjectCreated(projectId: string, sourceType: 'zip' | 'github' | 'template' | 'paste') {
  posthog.capture('project_created', { project_id: projectId, source_type: sourceType });
}

export function trackDeployStarted(projectId: string) {
  posthog.capture('deploy_started', { project_id: projectId });
}

export function trackDeploySuccess(projectId: string) {
  posthog.capture('deploy_success', { project_id: projectId });
}

export function trackRunExecuted(projectId: string, endpointId: string, lane: string) {
  posthog.capture('run_executed', { project_id: projectId, endpoint_id: endpointId, lane });
}

export function trackShareLinkCreated(projectId: string, targetType: string) {
  posthog.capture('share_link_created', { project_id: projectId, target_type: targetType });
}

export function trackTemplateUsed(templateId: string) {
  posthog.capture('template_used', { template_id: templateId });
}
