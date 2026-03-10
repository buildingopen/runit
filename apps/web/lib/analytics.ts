// Analytics stubs (no-op in OSS mode)
export function trackProjectCreated(_projectId: string, _sourceType: string) {}
export function trackDeployStarted(_projectId: string) {}
export function trackDeploySuccess(_projectId: string) {}
export function trackRunExecuted(_projectId: string, _endpointId: string, _lane: string) {}
export function trackShareLinkCreated(_projectId: string, _targetType: string) {}
export function trackTemplateUsed(_templateId: string) {}
