// ABOUTME: Routes for listing and fetching template details. Public endpoints, no auth required.
// ABOUTME: Reads template metadata and code from the runner/templates/ directory.

import { Hono } from 'hono';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import AdmZip from 'adm-zip';
import { getAuthContext } from '../middleware/auth.js';

const templates = new Hono();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Templates live in services/runner/templates/
function getTemplatesDir(): string {
  // From dist/routes/ -> ../../services/runner/templates OR from src/routes/ -> ../../../services/runner/templates
  const candidates = [
    join(__dirname, '..', '..', '..', '..', 'runner', 'templates'),
    join(__dirname, '..', '..', '..', 'runner', 'templates'),
  ];
  for (const dir of candidates) {
    if (existsSync(dir)) return dir;
  }
  return candidates[0];
}

interface TemplateMetadata {
  id: string;
  name: string;
  description: string;
  category: string;
  requiredSecrets: string[];
}

function loadTemplates(): TemplateMetadata[] {
  const dir = getTemplatesDir();
  if (!existsSync(dir)) return [];

  const entries = readdirSync(dir, { withFileTypes: true });
  const result: TemplateMetadata[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const metaPath = join(dir, entry.name, 'metadata.json');
    if (!existsSync(metaPath)) continue;

    try {
      const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
      result.push(meta);
    } catch {
      // Skip malformed templates
    }
  }

  return result;
}

/**
 * GET /templates - List all templates
 */
templates.get('/', (c) => {
  const templateList = loadTemplates();
  return c.json({ templates: templateList });
});

/**
 * GET /templates/:id - Get template details with code preview
 */
templates.get('/:id', (c) => {
  const templateId = c.req.param('id');
  // Sanitize template ID to prevent directory traversal
  if (!/^[a-zA-Z0-9_-]+$/.test(templateId)) {
    return c.json({ error: 'Invalid template ID' }, 400);
  }
  const dir = getTemplatesDir();
  const templateDir = join(dir, templateId);

  if (!existsSync(templateDir)) {
    return c.json({ error: 'Template not found' }, 404);
  }

  const metaPath = join(templateDir, 'metadata.json');
  if (!existsSync(metaPath)) {
    return c.json({ error: 'Template metadata not found' }, 404);
  }

  const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));

  // Load code files
  const files: Record<string, string> = {};
  const codeFiles = ['main.py', 'requirements.txt'];
  for (const filename of codeFiles) {
    const filePath = join(templateDir, filename);
    if (existsSync(filePath)) {
      files[filename] = readFileSync(filePath, 'utf-8');
    }
  }

  return c.json({
    ...meta,
    files,
  });
});

/**
 * POST /templates/:id/create - Create a project from a template
 * Builds a proper ZIP from the template files and returns the created project.
 * Requires authentication.
 */
templates.post('/:id/create', async (c) => {
  const authContext = getAuthContext(c);
  if (!authContext.isAuthenticated || !authContext.user) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const templateId = c.req.param('id');
  // Sanitize template ID to prevent directory traversal
  if (!/^[a-zA-Z0-9_-]+$/.test(templateId)) {
    return c.json({ error: 'Invalid template ID' }, 400);
  }

  const dir = getTemplatesDir();
  const templateDir = join(dir, templateId);

  if (!existsSync(templateDir)) {
    return c.json({ error: 'Template not found' }, 404);
  }

  const metaPath = join(templateDir, 'metadata.json');
  if (!existsSync(metaPath)) {
    return c.json({ error: 'Template metadata not found' }, 404);
  }

  const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));

  // Build a real ZIP from template files
  const zip = new AdmZip();
  const codeFiles = ['main.py', 'requirements.txt'];
  for (const filename of codeFiles) {
    const filePath = join(templateDir, filename);
    if (existsSync(filePath)) {
      zip.addFile(filename, readFileSync(filePath));
    }
  }

  const zipBuffer = zip.toBuffer();
  const zipBase64 = zipBuffer.toString('base64');

  return c.json({
    template_id: meta.id,
    name: meta.name,
    zip_data: zipBase64,
    detected_env_vars: meta.requiredSecrets || [],
  });
});

export default templates;
