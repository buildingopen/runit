#!/usr/bin/env node
// ABOUTME: RunIt CLI entry point. Commands: deploy, list, logs, delete.
// ABOUTME: Connects to RUNIT_URL with RUNIT_API_KEY. Binary: npx @runit/cli or npx runit.

import { Command } from 'commander';
import { readFileSync, existsSync } from 'fs';
import { basename, resolve } from 'path';
import { fileURLToPath } from 'url';
import { RunitClient } from '@runit/client';

const RUNIT_URL = process.env.RUNIT_URL || 'http://localhost:3001';
const RUNIT_API_KEY = process.env.RUNIT_API_KEY || '';

function getClient(): RunitClient {
  return new RunitClient({
    baseUrl: RUNIT_URL,
    apiKey: RUNIT_API_KEY || undefined,
  });
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
  .option('-n, --name <name>', 'Project name (defaults to filename)')
  .option('-r, --requirements <file>', 'Path to requirements.txt')
  .action(async (file: string, opts: { name?: string; requirements?: string }) => {
    const client = getClient();

    if (!existsSync(file)) {
      console.error(`File not found: ${file}`);
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

      console.log(`\nDeployed successfully!`);
      console.log(`  Status:     ${result.status}`);
      console.log(`  Project ID: ${result.project_id}`);
      console.log(`  Version:    ${result.version_hash}`);

      if (result.url) {
        console.log(`  Share URL:  ${RUNIT_URL}${result.url}`);
      }

      if (result.endpoints.length > 0) {
        console.log(`\n  Endpoints:`);
        for (const ep of result.endpoints) {
          console.log(`    ${ep.method} ${ep.path} - ${ep.summary || ''}`);
        }
      }

      if (result.detected_env_vars.length > 0) {
        console.log(`\n  Required env vars: ${result.detected_env_vars.join(', ')}`);
        console.log(`  Set them with: runit secrets set <project_id> <KEY> <VALUE>`);
      }
    } catch (error) {
      console.error(`Deploy failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

// ---- list ----
program
  .command('list')
  .description('List all deployed projects')
  .action(async () => {
    const client = getClient();

    try {
      const { projects } = await client.listProjects();

      if (projects.length === 0) {
        console.log('No projects found. Deploy one with: runit deploy main.py');
        return;
      }

      console.log(`${projects.length} project(s):\n`);
      for (const p of projects) {
        console.log(`  ${p.name}`);
        console.log(`    ID:      ${p.project_id}`);
        console.log(`    Slug:    ${p.project_slug}`);
        console.log(`    Status:  ${p.status || 'unknown'}`);
        console.log(`    Created: ${p.created_at}`);
        console.log('');
      }
    } catch (error) {
      console.error(`Failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

// ---- logs ----
program
  .command('logs <project_id>')
  .description('Get recent run logs for a project')
  .option('-l, --limit <n>', 'Number of runs to show', '10')
  .action(async (projectId: string, opts: { limit: string }) => {
    const client = getClient();
    const limit = parseInt(opts.limit, 10) || 10;

    try {
      const { runs } = await client.getProjectRuns(projectId, limit);

      if (runs.length === 0) {
        console.log('No runs found for this project.');
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
      console.error(`Failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

// ---- delete ----
program
  .command('delete <project_id>')
  .description('Delete a project')
  .action(async (projectId: string) => {
    const client = getClient();

    try {
      await client.deleteProject(projectId);
      console.log(`Project ${projectId} deleted.`);
    } catch (error) {
      console.error(`Failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

// ---- versions ----
program
  .command('versions <project_id>')
  .description('List all versions for a project')
  .action(async (projectId: string) => {
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
      console.error(`Failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

// ---- promote ----
program
  .command('promote <project_id>')
  .description('Promote dev version to production')
  .option('-v, --version <version_id>', 'Specific version to promote (defaults to dev)')
  .action(async (projectId: string, opts: { version?: string }) => {
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
      console.error(`Failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

// ---- rollback ----
program
  .command('rollback <project_id> <version_id>')
  .description('Rollback production to a specific version')
  .action(async (projectId: string, versionId: string) => {
    const client = getClient();

    try {
      const result = await client.rollback(projectId, versionId);
      console.log(`Rolled back to version ${result.version_hash} (${result.version_id}).`);
    } catch (error) {
      console.error(`Failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

// ---- storage ----
const storageCmd = program
  .command('storage')
  .description('Manage persistent key-value storage for a project');

storageCmd
  .command('list <project_id>')
  .description('List all storage keys')
  .action(async (projectId: string) => {
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
      console.error(`Failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

storageCmd
  .command('get <project_id> <key>')
  .description('Get a storage value')
  .action(async (projectId: string, key: string) => {
    const client = getClient();

    try {
      const result = await client.getStorage(projectId, key);
      console.log(JSON.stringify(result.value, null, 2));
    } catch (error) {
      console.error(`Failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

storageCmd
  .command('set <project_id> <key> <value>')
  .description('Set a storage value (JSON string)')
  .action(async (projectId: string, key: string, value: string) => {
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
      console.error(`Failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

storageCmd
  .command('delete <project_id> <key>')
  .description('Delete a storage value')
  .action(async (projectId: string, key: string) => {
    const client = getClient();

    try {
      await client.deleteStorage(projectId, key);
      console.log(`Deleted "${key}".`);
    } catch (error) {
      console.error(`Failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

// ---- secrets ----
const secretsCmd = program
  .command('secrets')
  .description('Manage encrypted secrets for a project');

secretsCmd
  .command('list <project_id>')
  .description('List all secrets (keys only)')
  .action(async (projectId: string) => {
    const client = getClient();
    try {
      const { secrets } = await client.listSecrets(projectId);
      if (secrets.length === 0) {
        console.log('No secrets configured.');
        return;
      }
      console.log(`${secrets.length} secret(s):\n`);
      for (const s of secrets) {
        console.log(`  ${s.key}  (updated: ${s.updated_at})`);
      }
    } catch (error) {
      console.error(`Failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

secretsCmd
  .command('set <project_id> <key> <value>')
  .description('Set a secret value')
  .action(async (projectId: string, key: string, value: string) => {
    const client = getClient();
    try {
      await client.setSecret(projectId, key, value);
      console.log(`Secret "${key}" set.`);
    } catch (error) {
      console.error(`Failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

secretsCmd
  .command('delete <project_id> <key>')
  .description('Delete a secret')
  .action(async (projectId: string, key: string) => {
    const client = getClient();
    try {
      await client.deleteSecret(projectId, key);
      console.log(`Secret "${key}" deleted.`);
    } catch (error) {
      console.error(`Failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

// ---- share ----
const shareCmd = program
  .command('share')
  .description('Manage share links for a project');

shareCmd
  .command('create <project_id> <endpoint_id>')
  .description('Create a share link for an endpoint')
  .action(async (projectId: string, endpointId: string) => {
    const client = getClient();
    try {
      const result = await client.createShareLink(projectId, 'endpoint_template', endpointId);
      console.log(`Share link created: ${RUNIT_URL}${result.share_url}`);
      console.log(`  Share ID: ${result.share_id}`);
    } catch (error) {
      console.error(`Failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

shareCmd
  .command('list <project_id>')
  .description('List all share links')
  .action(async (projectId: string) => {
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
      console.error(`Failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

shareCmd
  .command('disable <project_id> <share_id>')
  .description('Disable a share link')
  .action(async (projectId: string, shareId: string) => {
    const client = getClient();
    try {
      await client.disableShareLink(projectId, shareId);
      console.log(`Share link ${shareId} disabled.`);
    } catch (error) {
      console.error(`Failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

// ---- context ----
const contextCmd = program
  .command('context')
  .description('Manage project context (external data for AI-enhanced endpoints)');

contextCmd
  .command('add <project_id> <name> <url>')
  .description('Fetch and attach context from a URL')
  .action(async (projectId: string, name: string, url: string) => {
    const client = getClient();
    try {
      const result = await client.fetchContext(projectId, url, name);
      console.log(`Context added: ${name}`);
      console.log(`  ID: ${result.id}`);
    } catch (error) {
      console.error(`Failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

contextCmd
  .command('list <project_id>')
  .description('List all context entries')
  .action(async (projectId: string) => {
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
      console.error(`Failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

contextCmd
  .command('remove <project_id> <context_id>')
  .description('Remove a context entry')
  .action(async (projectId: string, contextId: string) => {
    const client = getClient();
    try {
      await client.deleteContext(projectId, contextId);
      console.log(`Context ${contextId} removed.`);
    } catch (error) {
      console.error(`Failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

// ---- status ----
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
      console.error(`Cannot connect to ${RUNIT_URL}: ${error instanceof Error ? error.message : String(error)}`);
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
