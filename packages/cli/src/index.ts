#!/usr/bin/env node
// ABOUTME: RunIt CLI entry point. Commands: deploy, list, logs, delete, open, etc.
// ABOUTME: Connects to RUNIT_URL with RUNIT_API_KEY. Binary: npx @runit/cli or npx runit.

import { Command } from 'commander';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { basename, resolve, join } from 'path';
import { fileURLToPath } from 'url';
import { exec, execSync } from 'child_process';
import { RunitClient } from '@runit/client';

const RUNIT_URL = process.env.RUNIT_URL || 'http://localhost:3001';
const RUNIT_API_KEY = process.env.RUNIT_API_KEY || '';

// ---- Project context persistence ----

interface ProjectContext {
  project_id: string;
  name: string;
  slug: string;
  deployed_at: string;
  actions: Array<{ method: string; path: string; summary: string }>;
  base_url: string;
}

function saveProjectContext(ctx: ProjectContext): void {
  const dir = join(process.cwd(), '.runit');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'project.json'), JSON.stringify(ctx, null, 2) + '\n');
}

function loadProjectContext(): ProjectContext | null {
  const file = join(process.cwd(), '.runit', 'project.json');
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf-8')) as ProjectContext;
  } catch {
    return null;
  }
}

function resolveAppId(arg: string | undefined): string {
  if (arg) return arg;
  const ctx = loadProjectContext();
  if (ctx) return ctx.project_id;
  console.error("No app specified. Deploy first with 'runit deploy' or pass an app name.");
  process.exit(1);
}

// ---- Error handling with recovery suggestions ----

function formatError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);

  if (msg.includes('ECONNREFUSED')) {
    return `Can't reach RunIt server at ${RUNIT_URL}. Is it running?`;
  }
  if (msg.includes('HTTP 401') || msg.includes('HTTP 403') || /\b(Unauthorized|Forbidden)\b/.test(msg)) {
    return `Authentication failed. Set your API key: export RUNIT_API_KEY=your-key`;
  }
  if (msg.includes('HTTP 404') || msg.includes('not found')) {
    return `App not found. Check with: runit list`;
  }
  if (msg.includes('no endpoints') || msg.includes('No endpoints')) {
    return `No functions found. Your Python file needs at least one function.`;
  }

  return msg;
}

// ---- Client ----

function getClient(): RunitClient {
  return new RunitClient({
    baseUrl: RUNIT_URL,
    apiKey: RUNIT_API_KEY || undefined,
  });
}

async function checkHealthEndpoint(url: string): Promise<{ ok: boolean; detail: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(`${url}/health`, { signal: controller.signal });
    if (!res.ok) return { ok: false, detail: `HTTP ${res.status}` };
    return { ok: true, detail: 'ok' };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, detail: message };
  } finally {
    clearTimeout(timeout);
  }
}

function hasDockerCli(): { ok: boolean; detail: string } {
  try {
    const version = execSync('docker --version', { encoding: 'utf-8' }).trim();
    return { ok: true, detail: version };
  } catch {
    return { ok: false, detail: 'docker command not found' };
  }
}

function canAccessDockerDaemon(): { ok: boolean; detail: string } {
  try {
    const output = execSync('docker info --format "{{.ServerVersion}}"', { encoding: 'utf-8' }).trim();
    return { ok: true, detail: `server ${output}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, detail: message.split('\n')[0] || 'cannot reach docker daemon' };
  }
}

export const program = new Command();

program
  .name('runit')
  .description('RunIt CLI - Deploy Python code from the terminal')
  .version('0.1.0');

// ---- deploy ----
program
  .command('deploy <file>')
  .description('Deploy a Python file or directory')
  .option('-n, --name <name>', 'App name (defaults to filename)')
  .option('-r, --requirements <file>', 'Path to requirements.txt')
  .action(async (file: string, opts: { name?: string; requirements?: string }) => {
    const client = getClient();

    if (!existsSync(file)) {
      console.error(`File '${file}' not found. Check the path.`);
      process.exit(1);
    }

    const code = readFileSync(file, 'utf-8');
    const name = opts.name || basename(file, '.py').replace(/[^a-z0-9-]/gi, '-').toLowerCase();

    let requirements: string[] | undefined;
    if (opts.requirements && existsSync(opts.requirements)) {
      requirements = readFileSync(opts.requirements, 'utf-8')
        .split('\n')
        .map(l => l.trim())
        .filter(l => l && !l.startsWith('#'));
    }

    console.log(`Deploying ${file} as "${name}"...`);

    try {
      const result = await client.deploy(code, name, requirements);

      const slug = result.project_slug || name;

      // Save project context for future commands
      saveProjectContext({
        project_id: result.project_id,
        name,
        slug,
        deployed_at: new Date().toISOString(),
        actions: result.endpoints.map(ep => ({
          method: ep.method,
          path: ep.path,
          summary: ep.summary || '',
        })),
        base_url: RUNIT_URL,
      });

      // Friendly post-deploy output
      console.log(`\nYour app is live!`);
      console.log('');
      console.log(`  Open it:  ${RUNIT_URL}/p/${slug}`);

      if (result.endpoints.length > 0) {
        // Build a "Try it" hint from the first action's path
        const firstEp = result.endpoints[0];
        const paramMatch = firstEp.path.match(/\{(\w+)\}/);
        if (paramMatch) {
          console.log(`  Try it:   runit run ${paramMatch[1]}="example"`);
        }

        console.log('');
        console.log(`  Actions:`);
        for (const ep of result.endpoints) {
          console.log(`    ${ep.method} ${ep.path} - ${ep.summary || ''}`);
        }
      }

      if (result.detected_env_vars.length > 0) {
        console.log('');
        console.log(`  API keys needed: ${result.detected_env_vars.join(', ')}`);
        console.log(`    Set with: runit secrets set ${name} ${result.detected_env_vars[0]} your-key`);
      }

      console.log('');
      console.log(`  (App: ${name}, ID: ${result.project_id})`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('no endpoints') || msg.includes('No endpoints')) {
        console.error(`Deploy failed: No functions found. Your Python file needs at least one function.`);
      } else {
        console.error(`Deploy failed: ${formatError(error)}`);
      }
      process.exit(1);
    }
  });

// ---- list ----
program
  .command('list')
  .description('List all deployed apps')
  .action(async () => {
    const client = getClient();

    try {
      const { projects } = await client.listProjects();

      if (projects.length === 0) {
        console.log('No apps found. Deploy one with: runit deploy main.py');
        return;
      }

      console.log(`${projects.length} app(s):\n`);
      for (const p of projects) {
        console.log(`  ${p.name}`);
        console.log(`    ID:      ${p.project_id}`);
        console.log(`    Slug:    ${p.project_slug}`);
        console.log(`    Status:  ${p.status || 'unknown'}`);
        console.log(`    Created: ${p.created_at}`);
        console.log('');
      }
    } catch (error) {
      console.error(`Failed: ${formatError(error)}`);
      process.exit(1);
    }
  });

// ---- logs ----
program
  .command('logs [app]')
  .description('Get recent run logs for an app')
  .option('-l, --limit <n>', 'Number of runs to show', '10')
  .action(async (app: string | undefined, opts: { limit: string }) => {
    const projectId = resolveAppId(app);
    const client = getClient();
    const limit = parseInt(opts.limit, 10) || 10;

    try {
      const { runs } = await client.getProjectRuns(projectId, limit);

      if (runs.length === 0) {
        console.log('No runs found for this app.');
        return;
      }

      console.log(`Recent runs:\n`);
      for (const run of runs) {
        const dur = run.duration_ms ? `${run.duration_ms}ms` : '-';
        console.log(`  ${run.run_id} | ${run.status.padEnd(7)} | ${run.endpoint_id} | ${dur} | ${run.created_at}`);
      }

      // Show details for the latest run
      try {
        const latest = await client.getRunStatus(runs[0].run_id);
        if (latest.result?.logs) {
          console.log(`\nLatest run logs:\n${latest.result.logs}`);
        }
        if (latest.result?.error_message) {
          console.log(`\nError: ${latest.result.error_class}: ${latest.result.error_message}`);
          if (latest.result.suggested_fix) {
            console.log(`Fix: ${latest.result.suggested_fix}`);
          }
        }
      } catch {
        // Non-fatal
      }
    } catch (error) {
      console.error(`Failed: ${formatError(error)}`);
      process.exit(1);
    }
  });

// ---- delete ----
program
  .command('delete [app]')
  .description('Delete an app')
  .action(async (app: string | undefined) => {
    const projectId = resolveAppId(app);
    const client = getClient();

    try {
      await client.deleteProject(projectId);
      console.log(`App ${projectId} deleted.`);
    } catch (error) {
      console.error(`Failed: ${formatError(error)}`);
      process.exit(1);
    }
  });

// ---- versions ----
program
  .command('versions [app]')
  .description('List all versions for an app')
  .action(async (app: string | undefined) => {
    const projectId = resolveAppId(app);
    const client = getClient();

    try {
      const result = await client.listVersions(projectId);

      if (result.versions.length === 0) {
        console.log('No versions found.');
        return;
      }

      console.log(`${result.total} version(s):\n`);
      for (const v of result.versions) {
        const flags = [
          v.is_dev ? 'DEV' : '',
          v.is_prod ? 'PROD' : '',
        ].filter(Boolean).join(', ');
        const flagStr = flags ? ` [${flags}]` : '';
        console.log(`  ${v.version_hash} (${v.version_id})${flagStr}`);
        console.log(`    Created: ${v.created_at} | Status: ${v.status}`);
        if (v.endpoints.length > 0) {
          for (const ep of v.endpoints) {
            console.log(`    ${ep.method} ${ep.path} - ${ep.summary || ''}`);
          }
        }
        console.log('');
      }

      console.log(`Dev version:  ${result.dev_version_id || 'none'}`);
      console.log(`Prod version: ${result.prod_version_id || 'none'}`);
    } catch (error) {
      console.error(`Failed: ${formatError(error)}`);
      process.exit(1);
    }
  });

// ---- promote ----
program
  .command('promote [app]')
  .description('Promote dev version to production')
  .option('-v, --version <version_id>', 'Specific version to promote (defaults to dev)')
  .action(async (app: string | undefined, opts: { version?: string }) => {
    const projectId = resolveAppId(app);
    const client = getClient();

    try {
      const result = await client.promote(projectId, opts.version);

      if (result.rolled_back) {
        console.error(`Promotion failed. Auto-rolled back.`);
        console.error(`Reason: ${result.reason}`);
        process.exit(1);
      }

      console.log(`Promoted version ${result.version_hash || result.version_id} to production.`);
      if (result.previous_version_id) {
        console.log(`Previous prod: ${result.previous_version_id}`);
      }
    } catch (error) {
      console.error(`Failed: ${formatError(error)}`);
      process.exit(1);
    }
  });

// ---- rollback ----
program
  .command('rollback <version_id>')
  .description('Rollback production to a specific version')
  .option('-a, --app <app>', 'App ID (auto-detected from .runit/project.json)')
  .action(async (versionId: string, opts: { app?: string }) => {
    const projectId = resolveAppId(opts.app);
    const client = getClient();

    try {
      const result = await client.rollback(projectId, versionId);
      console.log(`Rolled back to version ${result.version_hash} (${result.version_id}).`);
    } catch (error) {
      console.error(`Failed: ${formatError(error)}`);
      process.exit(1);
    }
  });

// ---- storage ----
const storageCmd = program
  .command('storage')
  .description('Manage persistent key-value storage for an app');

storageCmd
  .command('list [app]')
  .description('List all storage keys')
  .action(async (app: string | undefined) => {
    const projectId = resolveAppId(app);
    const client = getClient();

    try {
      const result = await client.listStorage(projectId);

      if (result.entries.length === 0) {
        console.log('No storage entries found.');
        return;
      }

      console.log(`${result.total} key(s), ${result.usage_bytes} / ${result.quota_bytes} bytes used:\n`);
      for (const e of result.entries) {
        console.log(`  ${e.key}  (${e.value_type}, ${e.size_bytes} bytes, updated: ${e.updated_at})`);
      }
    } catch (error) {
      console.error(`Failed: ${formatError(error)}`);
      process.exit(1);
    }
  });

storageCmd
  .command('get <key>')
  .description('Get a storage value')
  .option('-a, --app <app>', 'App ID (auto-detected from .runit/project.json)')
  .action(async (key: string, opts: { app?: string }) => {
    const projectId = resolveAppId(opts.app);
    const client = getClient();

    try {
      const result = await client.getStorage(projectId, key);
      console.log(JSON.stringify(result.value, null, 2));
    } catch (error) {
      console.error(`Failed: ${formatError(error)}`);
      process.exit(1);
    }
  });

storageCmd
  .command('set <key> <value>')
  .description('Set a storage value (JSON string)')
  .option('-a, --app <app>', 'App ID (auto-detected from .runit/project.json)')
  .action(async (key: string, value: string, opts: { app?: string }) => {
    const projectId = resolveAppId(opts.app);
    const client = getClient();

    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch {
      // Treat as raw string
      parsed = value;
    }

    try {
      const result = await client.putStorage(projectId, key, parsed);
      console.log(`Stored "${key}" (${result.size_bytes} bytes)`);
    } catch (error) {
      console.error(`Failed: ${formatError(error)}`);
      process.exit(1);
    }
  });

storageCmd
  .command('delete <key>')
  .description('Delete a storage value')
  .option('-a, --app <app>', 'App ID (auto-detected from .runit/project.json)')
  .action(async (key: string, opts: { app?: string }) => {
    const projectId = resolveAppId(opts.app);
    const client = getClient();

    try {
      await client.deleteStorage(projectId, key);
      console.log(`Deleted "${key}".`);
    } catch (error) {
      console.error(`Failed: ${formatError(error)}`);
      process.exit(1);
    }
  });

// ---- secrets (API Keys) ----
const secretsCmd = program
  .command('secrets')
  .description('Manage API keys for an app');

secretsCmd
  .command('list [app]')
  .description('List all API keys (names only)')
  .action(async (app: string | undefined) => {
    const projectId = resolveAppId(app);
    const client = getClient();
    try {
      const { secrets } = await client.listSecrets(projectId);
      if (secrets.length === 0) {
        console.log('No API keys configured.');
        return;
      }
      console.log(`${secrets.length} API key(s):\n`);
      for (const s of secrets) {
        console.log(`  ${s.key}  (updated: ${s.updated_at})`);
      }
    } catch (error) {
      console.error(`Failed: ${formatError(error)}`);
      process.exit(1);
    }
  });

secretsCmd
  .command('set <key> <value>')
  .description('Set an API key')
  .option('-a, --app <app>', 'App ID (auto-detected from .runit/project.json)')
  .action(async (key: string, value: string, opts: { app?: string }) => {
    const projectId = resolveAppId(opts.app);
    const client = getClient();
    try {
      await client.setSecret(projectId, key, value);
      console.log(`API key "${key}" set.`);
    } catch (error) {
      console.error(`Failed: ${formatError(error)}`);
      process.exit(1);
    }
  });

secretsCmd
  .command('delete <key>')
  .description('Delete an API key')
  .option('-a, --app <app>', 'App ID (auto-detected from .runit/project.json)')
  .action(async (key: string, opts: { app?: string }) => {
    const projectId = resolveAppId(opts.app);
    const client = getClient();
    try {
      await client.deleteSecret(projectId, key);
      console.log(`API key "${key}" deleted.`);
    } catch (error) {
      console.error(`Failed: ${formatError(error)}`);
      process.exit(1);
    }
  });

// ---- share ----
const shareCmd = program
  .command('share')
  .description('Manage share links for an app');

shareCmd
  .command('create <endpoint_id>')
  .description('Create a share link for an action')
  .option('-a, --app <app>', 'App ID (auto-detected from .runit/project.json)')
  .action(async (endpointId: string, opts: { app?: string }) => {
    const projectId = resolveAppId(opts.app);
    const client = getClient();
    try {
      const result = await client.createShareLink(projectId, 'endpoint_template', endpointId);
      console.log(`Share link created: ${RUNIT_URL}${result.share_url}`);
      console.log(`  Share ID: ${result.share_id}`);
    } catch (error) {
      console.error(`Failed: ${formatError(error)}`);
      process.exit(1);
    }
  });

shareCmd
  .command('list [app]')
  .description('List all share links')
  .action(async (app: string | undefined) => {
    const projectId = resolveAppId(app);
    const client = getClient();
    try {
      const { shares, total } = await client.listShareLinks(projectId);
      if (shares.length === 0) {
        console.log('No share links found.');
        return;
      }
      console.log(`${total} share link(s):\n`);
      for (const s of shares) {
        const status = s.enabled ? 'active' : 'disabled';
        console.log(`  ${s.share_id} [${status}]`);
        console.log(`    URL: ${RUNIT_URL}${s.share_url}`);
        console.log(`    Target: ${s.target_type} -> ${s.target_ref}`);
        console.log(`    Runs: ${s.stats.run_count} (${s.stats.success_count} successful)`);
        console.log('');
      }
    } catch (error) {
      console.error(`Failed: ${formatError(error)}`);
      process.exit(1);
    }
  });

shareCmd
  .command('disable <share_id>')
  .description('Disable a share link')
  .option('-a, --app <app>', 'App ID (auto-detected from .runit/project.json)')
  .action(async (shareId: string, opts: { app?: string }) => {
    const projectId = resolveAppId(opts.app);
    const client = getClient();
    try {
      await client.disableShareLink(projectId, shareId);
      console.log(`Share link ${shareId} disabled.`);
    } catch (error) {
      console.error(`Failed: ${formatError(error)}`);
      process.exit(1);
    }
  });

// ---- context ----
const contextCmd = program
  .command('context')
  .description('Manage app context (external data for AI-enhanced actions)');

contextCmd
  .command('add <name> <url>')
  .description('Fetch and attach context from a URL')
  .option('-a, --app <app>', 'App ID (auto-detected from .runit/project.json)')
  .action(async (name: string, url: string, opts: { app?: string }) => {
    const projectId = resolveAppId(opts.app);
    const client = getClient();
    try {
      const result = await client.fetchContext(projectId, url, name);
      console.log(`Context added: ${name}`);
      console.log(`  ID: ${result.id}`);
    } catch (error) {
      console.error(`Failed: ${formatError(error)}`);
      process.exit(1);
    }
  });

contextCmd
  .command('list [app]')
  .description('List all context entries')
  .action(async (app: string | undefined) => {
    const projectId = resolveAppId(app);
    const client = getClient();
    try {
      const { contexts } = await client.listContexts(projectId);
      if (contexts.length === 0) {
        console.log('No context entries found.');
        return;
      }
      console.log(`${contexts.length} context(s):\n`);
      for (const ctx of contexts) {
        console.log(`  ${ctx.id} [${ctx.name || 'unnamed'}]`);
        console.log(`    URL: ${ctx.url}`);
        console.log(`    Size: ${ctx.size} bytes`);
        console.log(`    Updated: ${ctx.updated_at}`);
        console.log('');
      }
    } catch (error) {
      console.error(`Failed: ${formatError(error)}`);
      process.exit(1);
    }
  });

contextCmd
  .command('remove <context_id>')
  .description('Remove a context entry')
  .option('-a, --app <app>', 'App ID (auto-detected from .runit/project.json)')
  .action(async (contextId: string, opts: { app?: string }) => {
    const projectId = resolveAppId(opts.app);
    const client = getClient();
    try {
      await client.deleteContext(projectId, contextId);
      console.log(`Context ${contextId} removed.`);
    } catch (error) {
      console.error(`Failed: ${formatError(error)}`);
      process.exit(1);
    }
  });

// ---- open ----
program
  .command('open [app]')
  .description('Open your app in the browser')
  .action(async (app: string | undefined) => {
    // Try to get slug from project context first
    let url: string;
    if (app) {
      url = `${RUNIT_URL}/p/${app}`;
    } else {
      const ctx = loadProjectContext();
      if (ctx) {
        url = `${ctx.base_url}/p/${ctx.slug}`;
      } else {
        console.error("No app specified. Deploy first with 'runit deploy' or pass an app name.");
        process.exit(1);
        return; // for TS narrowing
      }
    }

    console.log(`Opening ${url}...`);

    const openCmd = process.platform === 'darwin' ? 'open' : 'xdg-open';
    exec(`${openCmd} "${url}"`, (err) => {
      if (err) {
        console.error(`Could not open browser: ${err.message}`);
        console.log(`Open manually: ${url}`);
      }
    });
  });

// ---- status ----
program
  .command('doctor')
  .description('Check local setup and give fix steps')
  .action(async () => {
    console.log('RunIt Doctor');
    console.log(`Server: ${RUNIT_URL}`);
    console.log('');

    const checks: Array<{ name: string; ok: boolean; detail: string; fix?: string }> = [];

    const health = await checkHealthEndpoint(RUNIT_URL);
    checks.push({
      name: 'API health endpoint',
      ok: health.ok,
      detail: health.detail,
      fix: `Start the API and verify ${RUNIT_URL}/health`,
    });

    checks.push({
      name: 'RUNIT_API_KEY set (optional)',
      ok: true,
      detail: RUNIT_API_KEY ? 'present' : 'not set',
      fix: 'Set it with: export RUNIT_API_KEY=your-key if your server requires auth',
    });

    const dockerCli = hasDockerCli();
    checks.push({
      name: 'Docker CLI',
      ok: dockerCli.ok,
      detail: dockerCli.detail,
      fix: 'Install Docker Desktop or Docker Engine',
    });

    if (dockerCli.ok) {
      const dockerDaemon = canAccessDockerDaemon();
      checks.push({
        name: 'Docker daemon access',
        ok: dockerDaemon.ok,
        detail: dockerDaemon.detail,
        fix: 'Start Docker and confirm your user can access the daemon',
      });
    }

    const hasProjectContext = Boolean(loadProjectContext());
    checks.push({
      name: 'Local app context (.runit/project.json)',
      ok: hasProjectContext,
      detail: hasProjectContext ? 'present' : 'missing',
      fix: "Run 'runit deploy main.py' once in this folder",
    });

    let failed = 0;
    for (const check of checks) {
      const icon = check.ok ? 'OK' : 'FAIL';
      console.log(`${icon}  ${check.name}: ${check.detail}`);
      if (!check.ok && check.fix) {
        failed++;
        console.log(`    Fix: ${check.fix}`);
      }
    }

    console.log('');
    if (failed === 0) {
      console.log('All checks passed. You are ready to deploy and run apps.');
      return;
    }

    console.log(`${failed} check(s) need attention before a smooth first run.`);
    process.exit(1);
  });

program
  .command('status')
  .description('Check RunIt server health')
  .action(async () => {
    const client = getClient();

    try {
      const health = await client.health();
      console.log(`Server: ${RUNIT_URL}`);
      console.log(`Status: ${health.status}`);
    } catch (error) {
      console.error(formatError(error));
      process.exit(1);
    }
  });

// Only auto-parse when executed directly as CLI entry point
try {
  const self = fileURLToPath(import.meta.url);
  if (process.argv[1] && resolve(process.argv[1]) === resolve(self)) {
    program.parseAsync();
  }
} catch {
  // Not the entry point (e.g., imported by tests)
}
