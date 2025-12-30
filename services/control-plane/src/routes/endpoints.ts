/**
 * Endpoints routes - List and get endpoint schemas
 */

import { Hono } from 'hono';
import type {
  ListEndpointsResponse,
  GetEndpointSchemaResponse
} from '@execution-layer/shared';
import { getProject } from './projects.js';

const endpoints = new Hono();

/**
 * GET /projects/:project_id/endpoints - List endpoints for a project version
 */
endpoints.get('/:project_id/endpoints', async (c) => {
  const project_id = c.req.param('project_id');
  const version_id = c.req.query('version_id');  // Optional

  const project = getProject(project_id);
  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  // Get version (latest if not specified)
  const version = version_id
    ? project.versions.find(v => v.version_id === version_id)
    : project.versions[project.versions.length - 1];

  if (!version) {
    return c.json({ error: 'Version not found' }, 404);
  }

  if (!version.endpoints) {
    return c.json({ error: 'OpenAPI not yet extracted for this version' }, 400);
  }

  const response: ListEndpointsResponse = {
    project_id,
    version_id: version.version_id,
    endpoints: version.endpoints.map(ep => ({
      endpoint_id: ep.id,
      method: ep.method,
      path: ep.path,
      summary: ep.summary,
      description: ep.description,
      requires_gpu: ep.requires_gpu || false,
      schema_ref: `/projects/${project_id}/versions/${version.version_id}/endpoints/${ep.id}/schema`,
    })),
  };

  return c.json(response);
});

/**
 * GET /projects/:project_id/versions/:version_id/endpoints/:endpoint_id/schema
 * Get full schema for an endpoint
 */
endpoints.get('/:project_id/versions/:version_id/endpoints/:endpoint_id/schema', async (c) => {
  const { project_id, version_id, endpoint_id } = c.req.param();

  const project = getProject(project_id);
  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  const version = project.versions.find(v => v.version_id === version_id);
  if (!version) {
    return c.json({ error: 'Version not found' }, 404);
  }

  if (!version.openapi) {
    return c.json({ error: 'OpenAPI not yet extracted' }, 400);
  }

  const endpoint = version.endpoints?.find(ep => ep.id === endpoint_id);
  if (!endpoint) {
    return c.json({ error: 'Endpoint not found' }, 404);
  }

  // Extract schema from OpenAPI spec
  const operation = version.openapi.paths?.[endpoint.path]?.[endpoint.method.toLowerCase()];
  if (!operation) {
    return c.json({ error: 'Endpoint schema not found in OpenAPI' }, 500);
  }

  const response: GetEndpointSchemaResponse = {
    endpoint_id,
    method: endpoint.method,
    path: endpoint.path,
    summary: operation.summary,
    description: operation.description,
    request_schema: operation.requestBody?.content?.['application/json']?.schema,
    response_schema: operation.responses?.['200']?.content?.['application/json']?.schema,
    parameters: operation.parameters,
  };

  return c.json(response);
});

export default endpoints;
