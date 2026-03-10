// ABOUTME: Hono routes to list endpoints for a project version and retrieve full OpenAPI schemas per endpoint.
// ABOUTME: Resolves $ref references in request/response schemas before returning them to the client.
/**
 * Endpoints routes - List and get endpoint schemas
 */

import { Hono } from 'hono';
import type {
  ListEndpointsResponse,
  GetEndpointSchemaResponse
} from '@runit/shared';
import { getProject } from './projects.js';
import { getAuthContext } from '../middleware/auth.js';
import { resolveSchemaRefs, type OpenAPISpec } from '../utils/schema-resolver.js';

const endpoints = new Hono();

/**
 * GET /projects/:project_id/endpoints - List endpoints for a project version
 */
endpoints.get('/:project_id/endpoints', async (c) => {
  const project_id = c.req.param('project_id');
  const version_id = c.req.query('version_id');  // Optional

  // Auth + ownership check
  const authContext = getAuthContext(c);
  if (!authContext.isAuthenticated || !authContext.user) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const project = await getProject(project_id);
  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }
  if (project.owner_id !== authContext.user.id) {
    return c.json({ error: 'Not authorized' }, 403);
  }

  // Get version (latest if not specified)
  const version = version_id
    ? project.versions.find((v: { version_id: string }) => v.version_id === version_id)
    : project.versions[project.versions.length - 1];

  if (!version) {
    return c.json({ error: 'Version not found' }, 404);
  }

  if (!version.endpoints) {
    return c.json({ error: 'No actions detected yet for this version' }, 400);
  }

  const response: ListEndpointsResponse = {
    project_id,
    version_id: version.version_id,
    endpoints: version.endpoints.map((ep: { id: string; method: string; path: string; summary?: string; description?: string; requires_gpu?: boolean }) => ({
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

  // Auth + ownership check
  const authContext = getAuthContext(c);
  if (!authContext.isAuthenticated || !authContext.user) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const project = await getProject(project_id);
  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }
  if (project.owner_id !== authContext.user.id) {
    return c.json({ error: 'Not authorized' }, 403);
  }

  const version = project.versions.find((v: { version_id: string }) => v.version_id === version_id);
  if (!version) {
    return c.json({ error: 'Version not found' }, 404);
  }

  if (!version.openapi) {
    return c.json({ error: 'No actions detected yet' }, 400);
  }

  const endpoint = version.endpoints?.find((ep: { id: string }) => ep.id === endpoint_id);
  if (!endpoint) {
    return c.json({ error: 'Endpoint not found' }, 404);
  }

  // Extract schema from OpenAPI spec
  const openapi = version.openapi as OpenAPISpec & { paths?: Record<string, Record<string, any>> };
  const operation = openapi.paths?.[endpoint.path]?.[endpoint.method.toLowerCase()];
  if (!operation) {
    return c.json({ error: 'Could not load details for this action' }, 500);
  }

  // Get raw schemas
  const rawRequestSchema = operation.requestBody?.content?.['application/json']?.schema;
  const rawResponseSchema = operation.responses?.['200']?.content?.['application/json']?.schema;

  // Resolve $ref references in both schemas
  const resolvedRequestSchema = rawRequestSchema
    ? resolveSchemaRefs(rawRequestSchema, openapi)
    : undefined;
  const resolvedResponseSchema = rawResponseSchema
    ? resolveSchemaRefs(rawResponseSchema, openapi)
    : undefined;

  const response: GetEndpointSchemaResponse = {
    endpoint_id,
    method: endpoint.method,
    path: endpoint.path,
    summary: operation.summary,
    description: operation.description,
    request_schema: resolvedRequestSchema,
    response_schema: resolvedResponseSchema,
    parameters: operation.parameters,
  };

  return c.json(response);
});

export default endpoints;
