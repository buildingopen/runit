/**
 * OpenAPI extraction route - Extract OpenAPI from uploaded code
 */

import { Hono } from 'hono';
import { getProject, updateVersionOpenAPI } from './projects.js';
import { extractOpenAPIFromZip } from '../openapi-extractor.js';

const openapi = new Hono();

/**
 * POST /projects/:project_id/versions/:version_id/extract-openapi
 * Extract OpenAPI schema from the project code
 */
openapi.post('/:project_id/versions/:version_id/extract-openapi', async (c) => {
  const { project_id, version_id } = c.req.param();

  const project = await getProject(project_id);
  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  const version = project.versions.find((v: { version_id: string }) => v.version_id === version_id);
  if (!version) {
    return c.json({ error: 'Version not found' }, 404);
  }

  try {
    // Extract OpenAPI from code bundle
    const { openapi: openapiSpec, endpoints } = await extractOpenAPIFromZip(version.code_bundle);

    // Store in version
    await updateVersionOpenAPI(project_id, version_id, openapiSpec, endpoints);

    return c.json({
      success: true,
      endpoints_count: endpoints.length,
      endpoints: endpoints.map((ep: { id: string; method: string; path: string; summary?: string }) => ({
        id: ep.id,
        method: ep.method,
        path: ep.path,
        summary: ep.summary,
      })),
    });
  } catch (error: any) {
    return c.json({
      error: 'Failed to extract OpenAPI',
      detail: error.message,
    }, 500);
  }
});

export default openapi;
