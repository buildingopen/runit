// ABOUTME: Single-call deploy endpoint: POST /v1/deploy. Combines project creation, code upload, deploy, and share link.
// ABOUTME: Agent sends code + name in one request, gets back a usable URL. The multi-step API stays for advanced use.

import { Hono } from 'hono';
import { createHash } from 'crypto';
import AdmZip from 'adm-zip';
import YAML from 'yaml';
import { extractOpenAPIFromZip } from '../lib/openapi/zip-extractor.js';
import { validateProjectName } from '../lib/validation-utils.js';
import { getAuthContext } from '../middleware/auth.js';
import * as projectsStore from '../db/projects-store.js';
import * as shareLinksStore from '../db/share-links-store.js';
import { incrementProjectsCount, getUserTier } from '../db/billing-store.js';
import { getTierLimits } from '../config/tiers.js';
import { runDeployment } from '../lib/deploy-bridge.js';
import * as deployState from '../lib/deploy-state.js';
import { logger } from '../lib/logger.js';
import type { RunitConfig } from '../lib/runit-yaml.js';

const oneClickDeploy = new Hono();

/**
 * POST /deploy - One-call deploy: code -> usable URL.
 *
 * Request body:
 *   { code: string, name: string, requirements?: string[], entrypoint?: string }
 *
 * `code` can be:
 *   - Raw Python source code (string starting with non-base64 chars)
 *   - Base64-encoded ZIP (standard project bundle)
 *
 * Response:
 *   { url, project_id, version_id, endpoints, share_id }
 */
oneClickDeploy.post('/', async (c) => {
  const authContext = getAuthContext(c);
  if (!authContext.isAuthenticated || !authContext.user) {
    return c.json({ error: 'Authentication required' }, 401);
  }
  const owner_id = authContext.user.id;

  let body: {
    code: string;
    name: string;
    requirements?: string[];
    entrypoint?: string;
    config?: RunitConfig;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.code) {
    return c.json({ error: 'Missing required field: code' }, 400);
  }
  if (!body.name) {
    return c.json({ error: 'Missing required field: name' }, 400);
  }

  const nameValidation = validateProjectName(body.name);
  if (!nameValidation.valid) {
    return c.json({ error: nameValidation.error }, 400);
  }

  // Determine if code is raw Python or a base64 ZIP
  let code_bundle: string;
  if (isBase64Zip(body.code)) {
    code_bundle = body.code;
  } else {
    // Raw Python source: wrap into a ZIP with main.py (+ optional requirements.txt + optional runit.yaml)
    code_bundle = createZipFromSource(body.code, body.requirements, body.config);
  }

  // If config provided and code was already a ZIP, inject runit.yaml into it
  if (body.config && isBase64Zip(body.code)) {
    code_bundle = injectRunitYaml(code_bundle, body.config);
  }

  // Compute a deterministic hash from normalized ZIP content, not raw ZIP bytes.
  // Raw ZIP bytes can differ across equivalent bundles due to metadata like timestamps.
  const baseVersionHash = computeDeterministicVersionHash(code_bundle);
  let version_hash = baseVersionHash;

  // Check if a project with this name already exists for this user (redeploy)
  const existingProjects = await projectsStore.listProjects(owner_id);
  const existingProject = existingProjects.find(p => p.name === body.name);
  const isNewProject = !existingProject;
  let project: projectsStore.Project;

  if (existingProject) {
    project = existingProject;
  } else {
    // Check tier limits
    let maxProjects = 5;
    try {
      const tier = await getUserTier(owner_id);
      const limits = getTierLimits(tier);
      maxProjects = limits.maxProjects;
    } catch (err) {
      logger.warn('Failed to check tier limits, using default', { error: String(err) });
    }

    // Create project atomically
    const newProject = await projectsStore.createProjectAtomic({
      owner_id,
      name: body.name,
    }, maxProjects);

    if (!newProject) {
      return c.json({
        error: `Project limit reached (${maxProjects} max). Upgrade to create more projects.`,
      }, 403);
    }
    project = newProject;
  }

  // Keep deterministic hashes for first occurrence, but avoid unique constraint
  // collisions when the same project deploys identical content repeatedly.
  const existingVersions = await projectsStore.listVersions(project.id);
  const duplicateCount = existingVersions.filter((v) => v.version_hash === baseVersionHash).length;
  if (duplicateCount > 0) {
    version_hash = `${baseVersionHash}-${duplicateCount + 1}`;
  }

  // Extract OpenAPI (handles both FastAPI and auto-wrapping)
  let openapi: Record<string, unknown> | null = null;
  let endpoints: projectsStore.Endpoint[] = [];
  let entrypoint: string | null = body.entrypoint || null;
  let detected_env_vars: string[] = [];
  let runit_config: RunitConfig | undefined;

  try {
    const extracted = await extractOpenAPIFromZip(code_bundle);
    openapi = extracted.openapi;
    endpoints = extracted.endpoints;
    entrypoint = entrypoint || extracted.entrypoint;
    detected_env_vars = extracted.detected_env_vars || [];
    runit_config = extracted.runit_config;
    if (extracted.auto_wrapped && extracted.updated_code_bundle) {
      code_bundle = extracted.updated_code_bundle;
    }
  } catch (error) {
    logger.warn('OpenAPI extraction failed (non-fatal)', { error: String(error) });
  }

  // Create version
  let version;
  try {
    version = await projectsStore.createVersion({
      project_id: project.id,
      version_hash,
      code_bundle_ref: code_bundle,
      openapi,
      endpoints,
      entrypoint,
      detected_env_vars,
      status: 'ready',
    });
  } catch (err) {
    if (isNewProject) {
      await projectsStore.deleteProject(project.id).catch(() => {});
    }
    throw err;
  }

  // Track billing (only for new projects)
  if (isNewProject) {
    incrementProjectsCount(owner_id).catch((err) => {
      logger.warn('Failed to increment projects count', { error: String(err) });
    });
  }

  // Auto-deploy if endpoints were found
  let deployStatus = 'draft';
  let environment = 'dev';
  if (endpoints.length > 0) {
    try {
      deployState.initDeploy(project.id);
      await projectsStore.updateProjectStatus(project.id, 'deploying', { deploy_error: null });
      // Run deploy synchronously (it's fast, just validates code + marks live)
      await runDeployment(project.id, version);
      deployStatus = 'live';

      // Set dev version
      await projectsStore.setDevVersion(project.id, version.id);

      // First deploy: auto-promote to prod too
      if (!project.prod_version_id) {
        await projectsStore.setProdVersion(project.id, version.id);
        environment = 'dev+prod';
      }
    } catch (err) {
      logger.warn('Auto-deploy failed', { error: String(err) });
      deployStatus = 'failed';
    }
  }

  // Create share link for the first endpoint (if any)
  let share_id: string | null = null;
  let share_url: string | null = null;
  if (endpoints.length > 0) {
    try {
      const shareLink = await shareLinksStore.createShareLink({
        project_id: project.id,
        target_type: 'endpoint_template',
        target_ref: endpoints[0].id,
        created_by: owner_id,
      });
      share_id = shareLink.id;
      share_url = `/s/${shareLink.id}`;
    } catch (err) {
      logger.warn('Failed to create share link', { error: String(err) });
    }
  }

  return c.json({
    url: share_url,
    project_id: project.id,
    project_slug: project.slug,
    version_id: version.id,
    version_hash: version.version_hash,
    status: deployStatus,
    environment,
    share_id,
    endpoints: endpoints.map((ep) => ({
      id: ep.id,
      method: ep.method,
      path: ep.path,
      summary: ep.summary,
      description: ep.description,
    })),
    detected_env_vars,
    runit_config: runit_config || null,
  }, 201);
});

/**
 * Check if a string looks like a base64-encoded ZIP (starts with PK magic bytes in base64).
 */
function isBase64Zip(data: string): boolean {
  // ZIP files in base64 start with "UEs" (PK\x03\x04 or PK\x05\x06 in base64)
  if (data.startsWith('UEs') || data.startsWith('UEsD') || data.startsWith('UEsF')) {
    return true;
  }
  // Also check if it looks like pure base64 (no newlines, only base64 chars) and is long enough
  if (data.length > 100 && /^[A-Za-z0-9+/=]+$/.test(data.substring(0, 200))) {
    try {
      const buf = Buffer.from(data.substring(0, 4), 'base64');
      return buf[0] === 0x50 && buf[1] === 0x4B;
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Create a base64-encoded ZIP from raw Python source code.
 */
function createZipFromSource(code: string, requirements?: string[], config?: RunitConfig): string {
  const zip = new AdmZip();
  zip.addFile('main.py', Buffer.from(code, 'utf-8'));
  if (requirements && requirements.length > 0) {
    zip.addFile('requirements.txt', Buffer.from(requirements.join('\n'), 'utf-8'));
  }
  if (config) {
    zip.addFile('runit.yaml', Buffer.from(YAML.stringify(config), 'utf-8'));
  }
  return zip.toBuffer().toString('base64');
}

/**
 * Inject runit.yaml into an existing base64-encoded ZIP.
 */
function injectRunitYaml(zipBase64: string, config: RunitConfig): string {
  const zip = new AdmZip(Buffer.from(zipBase64, 'base64'));
  zip.addFile('runit.yaml', Buffer.from(YAML.stringify(config), 'utf-8'));
  return zip.toBuffer().toString('base64');
}

/**
 * Compute a stable content hash for a base64 ZIP bundle.
 * Hash input is normalized as:
 *   <entry-name>\n<entry-bytes>\n
 * over all non-directory entries sorted by entry name.
 */
function computeDeterministicVersionHash(zipBase64: string): string {
  try {
    const zip = new AdmZip(Buffer.from(zipBase64, 'base64'));
    const entries = zip
      .getEntries()
      .filter((entry) => !entry.isDirectory)
      .sort((a, b) => a.entryName.localeCompare(b.entryName));

    const hasher = createHash('sha256');
    for (const entry of entries) {
      hasher.update(entry.entryName, 'utf-8');
      hasher.update('\n', 'utf-8');
      hasher.update(entry.getData());
      hasher.update('\n', 'utf-8');
    }
    return hasher.digest('hex').substring(0, 12);
  } catch {
    // Fallback to raw bundle hashing for malformed bundles
    return createHash('sha256').update(zipBase64).digest('hex').substring(0, 12);
  }
}

export default oneClickDeploy;
