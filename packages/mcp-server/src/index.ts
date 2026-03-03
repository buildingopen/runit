#!/usr/bin/env node
// ABOUTME: RunIt MCP server entry point. Exposes deploy, run, list_projects, manage_secrets, get_logs, share link, and context tools.
// ABOUTME: Uses stdio transport for Claude Desktop/Cursor. Connects to RUNIT_URL with RUNIT_API_KEY.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { RunitClient } from '@runit/client';

const RUNIT_URL = process.env.RUNIT_URL || 'http://localhost:3001';
const RUNIT_API_KEY = process.env.RUNIT_API_KEY || '';

const client = new RunitClient({
  baseUrl: RUNIT_URL,
  apiKey: RUNIT_API_KEY || undefined,
});

const server = new McpServer({
  name: 'runit',
  version: '0.1.0',
});

// ---- Tool: deploy ----
server.tool(
  'deploy',
  'Deploy Python code to RunIt and get a usable URL. Accepts raw Python source or a base64-encoded ZIP. Optionally include a runit.yaml config to declare endpoint schemas, secrets, and resource requirements.',
  {
    code: z.string().describe('Python source code or base64-encoded ZIP bundle'),
    name: z.string().describe('Project name (lowercase, hyphens allowed)'),
    requirements: z.array(z.string()).optional().describe('Python package requirements (e.g. ["requests==2.31.0", "pandas"])'),
    config: z.object({
      name: z.string().optional(),
      version: z.union([z.number(), z.string()]).optional(),
      runtime: z.string().optional(),
      entrypoint: z.string().optional(),
      endpoints: z.record(z.object({
        description: z.string().optional(),
        summary: z.string().optional(),
        inputs: z.record(z.unknown()).optional(),
        outputs: z.record(z.unknown()).optional(),
        lane: z.enum(['cpu', 'gpu']).optional(),
        timeout_seconds: z.number().optional(),
      })).optional(),
      secrets: z.union([z.array(z.string()), z.record(z.unknown())]).optional(),
      network: z.boolean().optional(),
      dependencies: z.array(z.string()).optional(),
    }).optional().describe('runit.yaml configuration: declare endpoint schemas, required secrets, and resource settings'),
  },
  async ({ code, name, requirements, config }) => {
    try {
      const result = await client.deploy(code, name, requirements, config as Record<string, unknown> | undefined);
      const lines = [
        `Deployed "${name}" successfully.`,
        `Status: ${result.status}`,
        `Project ID: ${result.project_id}`,
        `Version: ${result.version_hash}`,
      ];
      if (result.url) {
        lines.push(`Share URL: ${RUNIT_URL}${result.url}`);
      }
      if (result.endpoints.length > 0) {
        lines.push(`\nEndpoints:`);
        for (const ep of result.endpoints) {
          lines.push(`  ${ep.method} ${ep.path} - ${ep.summary || '(no description)'}`);
        }
      }
      if (result.detected_env_vars.length > 0) {
        lines.push(`\nDetected env vars: ${result.detected_env_vars.join(', ')}`);
        lines.push(`Set them with the manage_secrets tool.`);
      }
      if (config) {
        lines.push(`\nrunit.yaml config applied.`);
      }
      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Deploy failed: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
    }
  }
);

// ---- Tool: run ----
server.tool(
  'run',
  'Execute an endpoint on a deployed RunIt project and return the result. Polls until complete.',
  {
    project_id: z.string().describe('Project ID'),
    endpoint_id: z.string().describe('Endpoint ID (e.g. "post--generate_invoice")'),
    version_id: z.string().describe('Version ID'),
    json: z.record(z.unknown()).optional().describe('JSON body to send to the endpoint'),
    params: z.record(z.unknown()).optional().describe('Query parameters'),
    timeout_seconds: z.number().optional().describe('Max execution time in seconds (default 60)'),
  },
  async ({ project_id, endpoint_id, version_id, json, params, timeout_seconds }) => {
    try {
      const run = await client.run(project_id, version_id, endpoint_id, {
        json,
        params,
        timeout_seconds,
      });

      // Poll for result
      const result = await client.waitForRun(run.run_id);

      const lines = [
        `Run ${result.run_id}: ${result.status}`,
        `Duration: ${result.duration_ms || 0}ms`,
      ];

      if (result.result) {
        lines.push(`HTTP Status: ${result.result.http_status}`);
        if (result.result.json !== undefined) {
          lines.push(`\nResponse:\n${JSON.stringify(result.result.json, null, 2)}`);
        }
        if (result.result.error_message) {
          lines.push(`\nError: ${result.result.error_class}: ${result.result.error_message}`);
          if (result.result.suggested_fix) {
            lines.push(`Fix: ${result.result.suggested_fix}`);
          }
        }
        if (result.result.logs) {
          lines.push(`\nLogs:\n${result.result.logs}`);
        }
      }

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Run failed: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
    }
  }
);

// ---- Tool: list_projects ----
server.tool(
  'list_projects',
  'List all deployed RunIt projects.',
  {},
  async () => {
    try {
      const { projects, total } = await client.listProjects();
      if (projects.length === 0) {
        return { content: [{ type: 'text' as const, text: 'No projects found. Use the deploy tool to create one.' }] };
      }

      const lines = [`${total} project(s):\n`];
      for (const p of projects) {
        lines.push(`  ${p.name} (${p.project_id})`);
        lines.push(`    Slug: ${p.project_slug}`);
        lines.push(`    Status: ${p.status || 'unknown'}`);
        lines.push(`    Created: ${p.created_at}`);
        lines.push('');
      }
      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Failed to list projects: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
    }
  }
);

// ---- Tool: get_project ----
server.tool(
  'get_project',
  'Get details for a RunIt project including endpoint schemas and input parameters. Use this before calling run to see what inputs an endpoint expects.',
  {
    project_id: z.string().describe('Project ID'),
  },
  async ({ project_id }) => {
    try {
      const project = await client.getProject(project_id);
      const lines = [
        `Project: ${project.name} (${project.project_id})`,
        `Slug: ${project.project_slug}`,
        `Status: ${project.status || 'unknown'}`,
        `Created: ${project.created_at}`,
      ];

      if (project.endpoints && project.endpoints.length > 0) {
        lines.push(`\nEndpoints:`);
        for (const ep of project.endpoints) {
          lines.push(`  ${ep.method} ${ep.path} [id: ${ep.id}]`);
          if (ep.summary) lines.push(`    Summary: ${ep.summary}`);
          if (ep.description) lines.push(`    Description: ${ep.description}`);
          if (ep.requestBody) {
            const schema = (ep.requestBody as any)?.content?.['application/json']?.schema;
            if (schema) {
              lines.push(`    Input schema: ${JSON.stringify(schema, null, 2).split('\n').join('\n    ')}`);
            }
          }
        }
      } else {
        lines.push('\nNo endpoints found.');
      }

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Failed to get project: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
    }
  }
);

// ---- Tool: manage_secrets ----
server.tool(
  'manage_secrets',
  'Manage secrets for a RunIt project. Supports list, set, and delete operations.',
  {
    project_id: z.string().describe('Project ID'),
    action: z.enum(['list', 'set', 'delete']).describe('Action to perform'),
    key: z.string().optional().describe('Secret key (required for set/delete)'),
    value: z.string().optional().describe('Secret value (required for set)'),
  },
  async ({ project_id, action, key, value }) => {
    try {
      if (action === 'list') {
        const { secrets } = await client.listSecrets(project_id);
        if (secrets.length === 0) {
          return { content: [{ type: 'text' as const, text: 'No secrets configured.' }] };
        }
        const lines = secrets.map(s => `  ${s.key} (updated: ${s.updated_at})`);
        return { content: [{ type: 'text' as const, text: `Secrets:\n${lines.join('\n')}` }] };
      }

      if (!key) {
        return { content: [{ type: 'text' as const, text: 'key is required for set/delete' }], isError: true };
      }

      if (action === 'set') {
        if (!value) {
          return { content: [{ type: 'text' as const, text: 'value is required for set' }], isError: true };
        }
        await client.setSecret(project_id, key, value);
        return { content: [{ type: 'text' as const, text: `Secret "${key}" set successfully.` }] };
      }

      if (action === 'delete') {
        await client.deleteSecret(project_id, key);
        return { content: [{ type: 'text' as const, text: `Secret "${key}" deleted.` }] };
      }

      return { content: [{ type: 'text' as const, text: `Unknown action: ${action}` }], isError: true };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Secrets operation failed: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
    }
  }
);

// ---- Tool: get_logs ----
server.tool(
  'get_logs',
  'Get recent run logs for a RunIt project.',
  {
    project_id: z.string().describe('Project ID'),
    limit: z.number().optional().describe('Number of recent runs to fetch (default 10)'),
  },
  async ({ project_id, limit }) => {
    try {
      const { runs } = await client.getProjectRuns(project_id, limit || 10);
      if (runs.length === 0) {
        return { content: [{ type: 'text' as const, text: 'No runs found for this project.' }] };
      }

      const lines = [`Recent runs for project ${project_id}:\n`];
      for (const run of runs) {
        lines.push(`  ${run.run_id} | ${run.status} | ${run.endpoint_id} | ${run.duration_ms || '-'}ms | ${run.created_at}`);
      }

      // Get details for the most recent run
      try {
        const latest = await client.getRunStatus(runs[0].run_id);
        if (latest.result?.logs) {
          lines.push(`\nLatest run logs:\n${latest.result.logs}`);
        }
        if (latest.result?.error_message) {
          lines.push(`\nLatest error: ${latest.result.error_class}: ${latest.result.error_message}`);
          if (latest.result.suggested_fix) {
            lines.push(`Suggested fix: ${latest.result.suggested_fix}`);
          }
        }
      } catch {
        // Non-fatal
      }

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Failed to get logs: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
    }
  }
);

// ---- Tool: list_versions ----
server.tool(
  'list_versions',
  'List all versions of a RunIt project. Shows which version is dev (latest deploy) and which is prod (promoted).',
  {
    project_id: z.string().describe('Project ID'),
  },
  async ({ project_id }) => {
    try {
      const result = await client.listVersions(project_id);
      if (result.versions.length === 0) {
        return { content: [{ type: 'text' as const, text: 'No versions found.' }] };
      }

      const lines = [`${result.total} version(s):\n`];
      for (const v of result.versions) {
        const flags = [
          v.is_dev ? 'DEV' : '',
          v.is_prod ? 'PROD' : '',
        ].filter(Boolean).join(', ');
        const flagStr = flags ? ` [${flags}]` : '';
        lines.push(`  ${v.version_hash} (${v.version_id})${flagStr}`);
        lines.push(`    Created: ${v.created_at} | Status: ${v.status}`);
        if (v.endpoints.length > 0) {
          for (const ep of v.endpoints) {
            lines.push(`    ${ep.method} ${ep.path} - ${ep.summary || ''}`);
          }
        }
        lines.push('');
      }

      lines.push(`Dev version: ${result.dev_version_id || 'none'}`);
      lines.push(`Prod version: ${result.prod_version_id || 'none'}`);

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Failed to list versions: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
    }
  }
);

// ---- Tool: promote ----
server.tool(
  'promote',
  'Promote a version to production. By default promotes the current dev version. Runs a health check; auto-rolls back if the check fails.',
  {
    project_id: z.string().describe('Project ID'),
    version_id: z.string().optional().describe('Version ID to promote (defaults to current dev version)'),
  },
  async ({ project_id, version_id }) => {
    try {
      const result = await client.promote(project_id, version_id);

      if (result.rolled_back) {
        return { content: [{ type: 'text' as const, text: `Promotion failed. Auto-rolled back to ${result.version_id}.\nReason: ${result.reason}` }] };
      }

      const lines = [
        `Promoted version ${result.version_hash || result.version_id} to production.`,
      ];
      if (result.previous_version_id) {
        lines.push(`Previous prod version: ${result.previous_version_id}`);
      }
      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Promote failed: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
    }
  }
);

// ---- Tool: rollback ----
server.tool(
  'rollback',
  'Rollback production to a previous version.',
  {
    project_id: z.string().describe('Project ID'),
    version_id: z.string().describe('Version ID to rollback to'),
  },
  async ({ project_id, version_id }) => {
    try {
      const result = await client.rollback(project_id, version_id);

      return { content: [{ type: 'text' as const, text: `Rolled back to version ${result.version_hash} (${result.version_id}).` }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Rollback failed: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
    }
  }
);

// ---- Tool: storage_set ----
server.tool(
  'storage_set',
  'Store a persistent key-value pair for a RunIt project. Values persist across runs and deploys.',
  {
    project_id: z.string().describe('Project ID'),
    key: z.string().describe('Storage key (alphanumeric, dots, underscores, hyphens; max 256 chars)'),
    value: z.unknown().describe('Value to store (any JSON-serializable data)'),
  },
  async ({ project_id, key, value }) => {
    try {
      const result = await client.putStorage(project_id, key, value);
      return { content: [{ type: 'text' as const, text: `Stored "${key}" (${result.size_bytes} bytes)` }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Storage set failed: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
    }
  }
);

// ---- Tool: storage_get ----
server.tool(
  'storage_get',
  'Retrieve a stored value for a RunIt project.',
  {
    project_id: z.string().describe('Project ID'),
    key: z.string().describe('Storage key'),
  },
  async ({ project_id, key }) => {
    try {
      const result = await client.getStorage(project_id, key);
      return { content: [{ type: 'text' as const, text: `Key: ${result.key}\nValue: ${JSON.stringify(result.value, null, 2)}` }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Storage get failed: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
    }
  }
);

// ---- Tool: storage_delete ----
server.tool(
  'storage_delete',
  'Delete a stored value for a RunIt project.',
  {
    project_id: z.string().describe('Project ID'),
    key: z.string().describe('Storage key'),
  },
  async ({ project_id, key }) => {
    try {
      await client.deleteStorage(project_id, key);
      return { content: [{ type: 'text' as const, text: `Deleted "${key}"` }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Storage delete failed: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
    }
  }
);

// ---- Tool: storage_list ----
server.tool(
  'storage_list',
  'List all stored keys for a RunIt project with usage info.',
  {
    project_id: z.string().describe('Project ID'),
  },
  async ({ project_id }) => {
    try {
      const result = await client.listStorage(project_id);
      if (result.entries.length === 0) {
        return { content: [{ type: 'text' as const, text: 'No storage entries found.' }] };
      }

      const lines = [
        `${result.total} key(s), ${result.usage_bytes} / ${result.quota_bytes} bytes used:\n`,
      ];
      for (const e of result.entries) {
        lines.push(`  ${e.key} (${e.value_type}, ${e.size_bytes} bytes, updated: ${e.updated_at})`);
      }
      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Storage list failed: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
    }
  }
);

// ---- Tool: create_share_link ----
server.tool(
  'create_share_link',
  'Create a public share link for a RunIt endpoint. Share links allow anyone to run the endpoint without authentication.',
  {
    project_id: z.string().describe('Project ID'),
    endpoint_id: z.string().describe('Endpoint ID to share (e.g. "post--generate")'),
  },
  async ({ project_id, endpoint_id }) => {
    try {
      const result = await client.createShareLink(project_id, 'endpoint_template', endpoint_id);
      return { content: [{ type: 'text' as const, text: `Share link created:\n  URL: ${RUNIT_URL}${result.share_url}\n  Share ID: ${result.share_id}` }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Failed: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
    }
  }
);

// ---- Tool: list_share_links ----
server.tool(
  'list_share_links',
  'List all share links for a RunIt project.',
  {
    project_id: z.string().describe('Project ID'),
  },
  async ({ project_id }) => {
    try {
      const { shares, total } = await client.listShareLinks(project_id);
      if (shares.length === 0) {
        return { content: [{ type: 'text' as const, text: 'No share links found.' }] };
      }
      const lines = [`${total} share link(s):\n`];
      for (const s of shares) {
        const status = s.enabled ? 'active' : 'disabled';
        lines.push(`  ${s.share_id} [${status}] -> ${s.target_type}:${s.target_ref} (${s.stats.run_count} runs)`);
      }
      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Failed: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
    }
  }
);

// ---- Tool: disable_share_link ----
server.tool(
  'disable_share_link',
  'Disable a share link for a RunIt project. The link will no longer be accessible.',
  {
    project_id: z.string().describe('Project ID'),
    share_id: z.string().describe('Share link ID to disable'),
  },
  async ({ project_id, share_id }) => {
    try {
      await client.disableShareLink(project_id, share_id);
      return { content: [{ type: 'text' as const, text: `Share link ${share_id} disabled.` }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Failed: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
    }
  }
);

// ---- Tool: fetch_context ----
server.tool(
  'fetch_context',
  'Fetch external data from a URL and attach it as context to a RunIt project. Context data enhances AI-powered endpoints.',
  {
    project_id: z.string().describe('Project ID'),
    name: z.string().describe('Context name (alphanumeric, hyphens, underscores)'),
    url: z.string().describe('URL to fetch context from'),
  },
  async ({ project_id, name, url }) => {
    try {
      const result = await client.fetchContext(project_id, url, name);
      return { content: [{ type: 'text' as const, text: `Context "${name}" added.\n  ID: ${result.id}` }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Failed: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
    }
  }
);

// ---- Tool: list_contexts ----
server.tool(
  'list_contexts',
  'List all context entries for a RunIt project.',
  {
    project_id: z.string().describe('Project ID'),
  },
  async ({ project_id }) => {
    try {
      const { contexts } = await client.listContexts(project_id);
      if (contexts.length === 0) {
        return { content: [{ type: 'text' as const, text: 'No context entries found.' }] };
      }
      const lines = [`${contexts.length} context(s):\n`];
      for (const ctx of contexts) {
        lines.push(`  ${ctx.id} [${ctx.name || 'unnamed'}] ${ctx.url} (${ctx.size} bytes)`);
      }
      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Failed: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
    }
  }
);

// ---- Tool: delete_context ----
server.tool(
  'delete_context',
  'Remove a context entry from a RunIt project.',
  {
    project_id: z.string().describe('Project ID'),
    context_id: z.string().describe('Context ID to remove'),
  },
  async ({ project_id, context_id }) => {
    try {
      await client.deleteContext(project_id, context_id);
      return { content: [{ type: 'text' as const, text: `Context ${context_id} removed.` }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Failed: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
    }
  }
);

// ---- Start server ----
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('MCP server error:', error);
  process.exit(1);
});
