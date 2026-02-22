/**
 * OpenAPI 3.0 Specification for Control Plane API
 *
 * This file is auto-generated from docs/openapi.yaml.
 * The YAML file is the source of truth for documentation purposes.
 */

export const openAPISpec = {
  openapi: '3.0.3',
  info: {
    title: 'Runtime API',
    description: `API for managing projects, runs, secrets, and deployments in the Runtime platform.

## Authentication
All endpoints (except health checks and metrics) require a valid Bearer token in the Authorization header.
Tokens are JWT tokens issued by Supabase Auth.

## Rate Limiting
- Authenticated users: 120 requests per minute
- Anonymous users: 60 requests per minute

## Versioning
All endpoints are available at both \`/v1/*\` (recommended) and \`/*\` (legacy, deprecated).`,
    version: '0.1.0',
    contact: {
      name: 'Runtime AI',
    },
    license: {
      name: 'Proprietary',
    },
  },
  servers: [
    { url: 'http://localhost:3001', description: 'Local development' },
    { url: 'https://api.runtime.ai', description: 'Production' },
  ],
  tags: [
    { name: 'Projects', description: 'Project management operations' },
    { name: 'Runs', description: 'Endpoint execution and run status' },
    { name: 'Secrets', description: 'Encrypted secrets management' },
    { name: 'Deploy', description: 'Deployment operations' },
    { name: 'Health', description: 'Health checks and metrics' },
  ],
  security: [{ BearerAuth: [] }],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Supabase Auth JWT token',
      },
    },
    schemas: {
      // ==================== Projects ====================
      Project: {
        type: 'object',
        required: ['project_id', 'project_slug', 'name', 'status', 'created_at', 'updated_at'],
        properties: {
          project_id: {
            type: 'string',
            format: 'uuid',
            description: 'Unique project identifier',
            example: '550e8400-e29b-41d4-a716-446655440000',
          },
          project_slug: {
            type: 'string',
            description: 'URL-friendly project slug',
            example: 'my-api-project-a1b2c3d4',
          },
          name: {
            type: 'string',
            description: 'Project display name',
            example: 'My API Project',
          },
          owner_id: {
            type: 'string',
            description: 'User ID of project owner',
            example: 'user_123abc',
          },
          status: {
            type: 'string',
            enum: ['draft', 'deploying', 'live', 'failed'],
            description: 'Current project deployment status',
            example: 'live',
          },
          deployed_at: {
            type: 'string',
            format: 'date-time',
            nullable: true,
            description: 'Timestamp of last successful deployment',
          },
          deploy_error: {
            type: 'string',
            nullable: true,
            description: 'Error message from failed deployment',
          },
          runtime_url: {
            type: 'string',
            format: 'uri',
            nullable: true,
            description: 'URL where the deployed project is accessible',
            example: 'https://my-project.modal.run',
          },
          detected_env_vars: {
            type: 'array',
            items: { type: 'string' },
            description: 'Environment variables detected in the code',
            example: ['API_KEY', 'DATABASE_URL'],
          },
          endpoints: {
            type: 'array',
            items: { $ref: '#/components/schemas/Endpoint' },
            description: 'List of API endpoints extracted from the project',
          },
          versions: {
            type: 'array',
            items: { $ref: '#/components/schemas/Version' },
            description: 'List of project versions',
          },
          created_at: {
            type: 'string',
            format: 'date-time',
            description: 'Project creation timestamp',
          },
          updated_at: {
            type: 'string',
            format: 'date-time',
            description: 'Project last update timestamp',
          },
        },
      },
      Version: {
        type: 'object',
        required: ['version_id', 'version_hash', 'created_at', 'status'],
        properties: {
          version_id: {
            type: 'string',
            format: 'uuid',
            description: 'Unique version identifier',
          },
          version_hash: {
            type: 'string',
            description: 'Short SHA256 hash of the code bundle',
            example: 'a1b2c3d4e5f6',
          },
          created_at: {
            type: 'string',
            format: 'date-time',
            description: 'Version creation timestamp',
          },
          status: {
            type: 'string',
            enum: ['building', 'ready', 'failed'],
            description: 'Version build status',
          },
        },
      },
      Endpoint: {
        type: 'object',
        required: ['id', 'method', 'path'],
        properties: {
          id: {
            type: 'string',
            description: 'Endpoint identifier (path-based)',
            example: 'GET_/users',
          },
          endpoint_id: {
            type: 'string',
            description: 'Endpoint identifier (alias for id)',
            example: 'GET_/users',
          },
          method: {
            type: 'string',
            enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
            description: 'HTTP method',
            example: 'GET',
          },
          path: {
            type: 'string',
            description: 'URL path pattern',
            example: '/users/{id}',
          },
          summary: {
            type: 'string',
            description: 'Brief description of the endpoint',
            example: 'Get user by ID',
          },
          description: {
            type: 'string',
            description: 'Detailed description of the endpoint',
          },
        },
      },
      CreateProjectRequest: {
        type: 'object',
        required: ['name', 'source_type'],
        properties: {
          name: {
            type: 'string',
            minLength: 1,
            maxLength: 100,
            description: 'Project display name',
            example: 'My API Project',
          },
          source_type: {
            type: 'string',
            enum: ['zip', 'github'],
            description: 'Source type for the project code',
            example: 'zip',
          },
          zip_data: {
            type: 'string',
            format: 'byte',
            description: "Base64-encoded ZIP file (required if source_type is 'zip')",
          },
          github_url: {
            type: 'string',
            format: 'uri',
            pattern: '^https://github\\.com/[\\w\\-\\.]+/[\\w\\-\\.]+(?:\\.git)?$',
            description: "GitHub repository URL (required if source_type is 'github')",
            example: 'https://github.com/user/repo',
          },
          github_ref: {
            type: 'string',
            description: 'Git branch or tag to clone',
            example: 'main',
          },
        },
      },
      CreateProjectResponse: {
        type: 'object',
        required: ['project_id', 'project_slug', 'version_id', 'version_hash', 'status'],
        properties: {
          project_id: {
            type: 'string',
            format: 'uuid',
            description: 'Created project ID',
          },
          project_slug: {
            type: 'string',
            description: 'URL-friendly project slug',
          },
          version_id: {
            type: 'string',
            format: 'uuid',
            description: 'Created version ID',
          },
          version_hash: {
            type: 'string',
            description: 'Version hash',
          },
          status: {
            type: 'string',
            enum: ['draft'],
            description: 'Initial project status',
          },
          detected_env_vars: {
            type: 'array',
            items: { type: 'string' },
            description: 'Environment variables detected in the code',
          },
          endpoints: {
            type: 'array',
            items: { $ref: '#/components/schemas/Endpoint' },
            description: 'Extracted API endpoints',
          },
        },
      },
      ListProjectsResponse: {
        type: 'object',
        required: ['projects', 'total'],
        properties: {
          projects: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                project_id: { type: 'string', format: 'uuid' },
                project_slug: { type: 'string' },
                name: { type: 'string' },
                status: { type: 'string', enum: ['draft', 'deploying', 'live', 'failed'] },
                latest_version: { type: 'string' },
                created_at: { type: 'string', format: 'date-time' },
                updated_at: { type: 'string', format: 'date-time' },
              },
            },
          },
          total: {
            type: 'integer',
            description: 'Total number of projects',
          },
        },
      },
      // ==================== Runs ====================
      Run: {
        type: 'object',
        required: ['run_id', 'project_id', 'version_id', 'endpoint_id', 'status', 'created_at'],
        properties: {
          run_id: {
            type: 'string',
            format: 'uuid',
            description: 'Unique run identifier',
          },
          project_id: {
            type: 'string',
            format: 'uuid',
            description: 'Project ID',
          },
          version_id: {
            type: 'string',
            format: 'uuid',
            description: 'Version ID used for the run',
          },
          endpoint_id: {
            type: 'string',
            description: 'Endpoint that was executed',
          },
          status: {
            type: 'string',
            enum: ['queued', 'running', 'success', 'error', 'timeout'],
            description: 'Current run status',
          },
          created_at: {
            type: 'string',
            format: 'date-time',
            description: 'Run creation timestamp',
          },
          started_at: {
            type: 'string',
            format: 'date-time',
            description: 'Run start timestamp',
          },
          completed_at: {
            type: 'string',
            format: 'date-time',
            description: 'Run completion timestamp',
          },
          duration_ms: {
            type: 'integer',
            description: 'Execution duration in milliseconds',
          },
          created_by: {
            type: 'string',
            description: 'User ID who created the run',
          },
          result: {
            $ref: '#/components/schemas/RunResult',
          },
        },
      },
      RunResult: {
        type: 'object',
        properties: {
          http_status: {
            type: 'integer',
            description: 'HTTP status code returned by the endpoint',
            example: 200,
          },
          content_type: {
            type: 'string',
            description: 'Response content type',
            example: 'application/json',
          },
          json: {
            type: 'object',
            description: 'Response body (if JSON)',
          },
          artifacts: {
            type: 'array',
            items: { $ref: '#/components/schemas/Artifact' },
            description: 'Generated artifacts (files, images, etc.)',
          },
          redactions_applied: {
            type: 'boolean',
            description: 'Whether PII redactions were applied',
          },
          error_class: {
            type: 'string',
            description: 'Error class (if failed)',
            example: 'ValueError',
          },
          error_message: {
            type: 'string',
            description: 'Error message (if failed)',
          },
          suggested_fix: {
            type: 'string',
            description: 'Suggested fix for the error',
          },
          logs: {
            type: 'string',
            description: 'Execution logs',
          },
        },
      },
      Artifact: {
        type: 'object',
        required: ['name', 'size', 'mime_type', 'download_url'],
        properties: {
          name: {
            type: 'string',
            description: 'Artifact filename',
          },
          size: {
            type: 'integer',
            description: 'File size in bytes',
          },
          mime_type: {
            type: 'string',
            description: 'MIME type',
            example: 'image/png',
          },
          download_url: {
            type: 'string',
            format: 'uri',
            description: 'URL to download the artifact',
          },
        },
      },
      CreateRunRequest: {
        type: 'object',
        required: ['project_id', 'version_id', 'endpoint_id'],
        properties: {
          project_id: {
            type: 'string',
            format: 'uuid',
            description: 'Project ID to run',
          },
          version_id: {
            type: 'string',
            format: 'uuid',
            description: 'Version ID to run',
          },
          endpoint_id: {
            type: 'string',
            description: 'Endpoint ID to execute',
          },
          params: {
            type: 'object',
            additionalProperties: true,
            description: 'URL/path parameters',
          },
          json: {
            type: 'object',
            additionalProperties: true,
            description: 'JSON request body',
          },
          headers: {
            type: 'object',
            additionalProperties: { type: 'string' },
            description: 'Request headers',
          },
          files: {
            type: 'array',
            items: {
              type: 'object',
              required: ['filename', 'data', 'content_type'],
              properties: {
                filename: { type: 'string' },
                data: { type: 'string', format: 'byte', description: 'Base64-encoded file content' },
                content_type: { type: 'string' },
              },
            },
            description: 'File uploads',
          },
          lane: {
            type: 'string',
            enum: ['cpu', 'gpu'],
            default: 'cpu',
            description: 'Resource lane (CPU or GPU)',
          },
          timeout_seconds: {
            type: 'integer',
            minimum: 1,
            maximum: 300,
            default: 60,
            description: 'Execution timeout in seconds',
          },
        },
      },
      CreateRunResponse: {
        type: 'object',
        required: ['run_id', 'status'],
        properties: {
          run_id: {
            type: 'string',
            format: 'uuid',
            description: 'Created run ID',
          },
          status: {
            type: 'string',
            enum: ['running'],
            description: 'Initial run status',
          },
        },
      },
      // ==================== Secrets ====================
      Secret: {
        type: 'object',
        required: ['id', 'key', 'created_at', 'updated_at'],
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Secret ID',
          },
          key: {
            type: 'string',
            description: 'Secret key name (UPPERCASE_SNAKE_CASE)',
            example: 'API_KEY',
          },
          created_at: {
            type: 'string',
            format: 'date-time',
            description: 'Creation timestamp',
          },
          updated_at: {
            type: 'string',
            format: 'date-time',
            description: 'Last update timestamp',
          },
        },
      },
      CreateSecretRequest: {
        type: 'object',
        required: ['key', 'value'],
        properties: {
          key: {
            type: 'string',
            pattern: '^[A-Z_][A-Z0-9_]*$',
            description: 'Secret key name (UPPERCASE_SNAKE_CASE, cannot start with __)',
            example: 'API_KEY',
          },
          value: {
            type: 'string',
            description: 'Secret value (will be encrypted)',
            example: 'sk-1234567890abcdef',
          },
        },
      },
      CreateSecretResponse: {
        type: 'object',
        required: ['id', 'key', 'created_at', 'updated_at'],
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Created secret ID',
          },
          key: {
            type: 'string',
            description: 'Secret key name',
          },
          created_at: {
            type: 'string',
            format: 'date-time',
          },
          updated_at: {
            type: 'string',
            format: 'date-time',
          },
        },
      },
      ListSecretsResponse: {
        type: 'object',
        required: ['secrets'],
        properties: {
          secrets: {
            type: 'array',
            items: { $ref: '#/components/schemas/Secret' },
            description: 'List of secrets (values never returned)',
          },
        },
      },
      // ==================== Deploy ====================
      DeployResponse: {
        type: 'object',
        required: ['status', 'streamUrl'],
        properties: {
          status: {
            type: 'string',
            enum: ['deploying'],
            description: 'Deployment status',
          },
          streamUrl: {
            type: 'string',
            description: 'SSE stream URL for deployment progress',
            example: '/projects/{id}/deploy/stream',
          },
        },
      },
      DeployStatusResponse: {
        type: 'object',
        required: ['status'],
        properties: {
          status: {
            type: 'string',
            enum: ['draft', 'deploying', 'live', 'failed'],
            description: 'Current deployment status',
          },
          step: {
            type: 'string',
            description: 'Current deployment step',
          },
          progress: {
            type: 'integer',
            minimum: 0,
            maximum: 100,
            description: 'Deployment progress percentage',
          },
          message: {
            type: 'string',
            description: 'Current status message',
          },
          deployed_at: {
            type: 'string',
            format: 'date-time',
            description: 'Last successful deployment timestamp',
          },
          deploy_error: {
            type: 'string',
            description: 'Deployment error message (if failed)',
          },
          runtime_url: {
            type: 'string',
            format: 'uri',
            description: 'Runtime URL (if deployed)',
          },
          error: {
            type: 'string',
            description: 'Error details',
          },
        },
      },
      // ==================== Health ====================
      HealthResponse: {
        type: 'object',
        required: ['status', 'uptime', 'timestamp'],
        properties: {
          status: {
            type: 'string',
            enum: ['healthy'],
            description: 'Health status',
          },
          uptime: {
            type: 'number',
            description: 'Server uptime in seconds',
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            description: 'Current server timestamp',
          },
        },
      },
      DeepHealthResponse: {
        type: 'object',
        required: ['status', 'uptime', 'timestamp', 'checks'],
        properties: {
          status: {
            type: 'string',
            enum: ['healthy', 'degraded', 'unhealthy'],
            description: 'Overall health status',
          },
          uptime: {
            type: 'number',
            description: 'Server uptime in seconds',
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
          },
          checks: {
            type: 'object',
            additionalProperties: {
              type: 'object',
              properties: {
                status: { type: 'string', enum: ['healthy', 'unhealthy', 'degraded', 'configured', 'not_configured'] },
                latency_ms: { type: 'integer' },
                error: { type: 'string' },
              },
            },
          },
          circuitBreakers: {
            type: 'object',
            additionalProperties: {
              type: 'object',
              properties: {
                state: { type: 'string', enum: ['closed', 'open', 'half-open'] },
                failures: { type: 'integer' },
              },
            },
          },
        },
      },
      // ==================== Errors ====================
      Error: {
        type: 'object',
        required: ['error'],
        properties: {
          error: {
            type: 'string',
            description: 'Error message',
            example: 'Project not found',
          },
          code: {
            type: 'string',
            description: 'Error code for programmatic handling',
            example: 'PROJECT_NOT_FOUND',
          },
          details: {
            type: 'string',
            description: 'Additional error details',
          },
        },
      },
      ValidationError: {
        type: 'object',
        required: ['error'],
        properties: {
          error: {
            type: 'string',
            description: 'Validation error message',
            example: 'Missing required fields: name, source_type',
          },
          received: {
            type: 'string',
            description: 'Value that was received (for debugging)',
          },
        },
      },
    },
    responses: {
      BadRequest: {
        description: 'Bad request - validation error',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ValidationError' },
            examples: {
              missingFields: { value: { error: 'Missing required fields: name, source_type' } },
              invalidFormat: { value: { error: 'Invalid secret key format. Use UPPERCASE_SNAKE_CASE (A-Z, 0-9, _)' } },
            },
          },
        },
      },
      Unauthorized: {
        description: 'Authentication required',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: { error: 'Authentication required' },
          },
        },
      },
      Forbidden: {
        description: 'Not authorized to access this resource',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: { error: 'Not authorized' },
          },
        },
      },
      NotFound: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            examples: {
              projectNotFound: { value: { error: 'Project not found' } },
              runNotFound: { value: { error: 'Run not found' } },
              versionNotFound: { value: { error: 'Version not found' } },
            },
          },
        },
      },
      TooManyRequests: {
        description: 'Rate limit exceeded',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: { error: 'Rate limit exceeded. Try again in 60 seconds.' },
          },
        },
        headers: {
          'Retry-After': { schema: { type: 'integer' }, description: 'Seconds to wait before retrying' },
          'X-RateLimit-Limit': { schema: { type: 'integer' }, description: 'Request limit per minute' },
          'X-RateLimit-Remaining': { schema: { type: 'integer' }, description: 'Remaining requests in the current window' },
        },
      },
      InternalServerError: {
        description: 'Internal server error',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: { error: 'Internal server error' },
          },
        },
      },
    },
  },
  paths: {
    // ==================== Projects ====================
    '/v1/projects': {
      post: {
        tags: ['Projects'],
        summary: 'Create a new project',
        description: 'Creates a new project from either a ZIP file upload or a GitHub repository. The code is analyzed to extract OpenAPI endpoints automatically.',
        operationId: 'createProject',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateProjectRequest' },
              examples: {
                zipUpload: { summary: 'ZIP file upload', value: { name: 'My API', source_type: 'zip', zip_data: 'UEsDBBQAAAAIAA...' } },
                githubImport: { summary: 'GitHub import', value: { name: 'My GitHub API', source_type: 'github', github_url: 'https://github.com/user/repo', github_ref: 'main' } },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Project created successfully', content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateProjectResponse' } } } },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '429': { $ref: '#/components/responses/TooManyRequests' },
          '500': { $ref: '#/components/responses/InternalServerError' },
        },
      },
      get: {
        tags: ['Projects'],
        summary: 'List all projects',
        description: 'Returns all projects owned by the authenticated user',
        operationId: 'listProjects',
        responses: {
          '200': { description: 'List of projects', content: { 'application/json': { schema: { $ref: '#/components/schemas/ListProjectsResponse' } } } },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '429': { $ref: '#/components/responses/TooManyRequests' },
          '500': { $ref: '#/components/responses/InternalServerError' },
        },
      },
    },
    '/v1/projects/{id}': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' }, description: 'Project ID' }],
      get: {
        tags: ['Projects'],
        summary: 'Get project details',
        description: 'Returns detailed information about a specific project including versions and endpoints',
        operationId: 'getProject',
        responses: {
          '200': { description: 'Project details', content: { 'application/json': { schema: { $ref: '#/components/schemas/Project' } } } },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '404': { $ref: '#/components/responses/NotFound' },
          '429': { $ref: '#/components/responses/TooManyRequests' },
          '500': { $ref: '#/components/responses/InternalServerError' },
        },
      },
      delete: {
        tags: ['Projects'],
        summary: 'Delete a project',
        description: 'Permanently deletes a project and all associated data (versions, secrets, runs, share links)',
        operationId: 'deleteProject',
        responses: {
          '200': {
            description: 'Project deleted successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['success', 'project_id'],
                  properties: {
                    success: { type: 'boolean', example: true },
                    project_id: { type: 'string', format: 'uuid' },
                  },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '404': { $ref: '#/components/responses/NotFound' },
          '429': { $ref: '#/components/responses/TooManyRequests' },
          '500': { $ref: '#/components/responses/InternalServerError' },
        },
      },
    },
    '/v1/projects/{id}/deploy': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' }, description: 'Project ID' }],
      post: {
        tags: ['Deploy'],
        summary: 'Deploy a project',
        description: "Starts deployment of the project's latest version to Modal. Returns a stream URL for real-time deployment progress.",
        operationId: 'deployProject',
        responses: {
          '200': { description: 'Deployment started', content: { 'application/json': { schema: { $ref: '#/components/schemas/DeployResponse' } } } },
          '400': { description: 'Bad request (e.g., no version available)', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' }, example: { error: 'No version available to deploy' } } } },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '404': { $ref: '#/components/responses/NotFound' },
          '409': { description: 'Deployment already in progress', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' }, example: { error: 'Deployment already in progress' } } } },
          '429': { $ref: '#/components/responses/TooManyRequests' },
          '500': { $ref: '#/components/responses/InternalServerError' },
        },
      },
    },
    // ==================== Secrets ====================
    '/v1/projects/{id}/secrets': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' }, description: 'Project ID' }],
      post: {
        tags: ['Secrets'],
        summary: 'Create or update a secret',
        description: 'Creates a new secret or updates an existing one. Secrets are encrypted at rest using KMS. Key names must be UPPERCASE_SNAKE_CASE and cannot start with __ (reserved prefix).',
        operationId: 'createSecret',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateSecretRequest' },
              example: { key: 'API_KEY', value: 'sk-1234567890abcdef' },
            },
          },
        },
        responses: {
          '201': { description: 'Secret created/updated successfully', content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateSecretResponse' } } } },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '429': { $ref: '#/components/responses/TooManyRequests' },
          '500': { $ref: '#/components/responses/InternalServerError' },
        },
      },
      get: {
        tags: ['Secrets'],
        summary: 'List all secrets',
        description: 'Returns all secrets for a project. Only keys and metadata are returned - values are never exposed via the API.',
        operationId: 'listSecrets',
        responses: {
          '200': { description: 'List of secrets', content: { 'application/json': { schema: { $ref: '#/components/schemas/ListSecretsResponse' } } } },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '429': { $ref: '#/components/responses/TooManyRequests' },
          '500': { $ref: '#/components/responses/InternalServerError' },
        },
      },
    },
    '/v1/projects/{id}/secrets/{key}': {
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' }, description: 'Project ID' },
        { name: 'key', in: 'path', required: true, schema: { type: 'string' }, description: 'Secret key name' },
      ],
      delete: {
        tags: ['Secrets'],
        summary: 'Delete a secret',
        description: 'Permanently deletes a secret',
        operationId: 'deleteSecret',
        responses: {
          '200': {
            description: 'Secret deleted successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['success'],
                  properties: { success: { type: 'boolean', example: true } },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '429': { $ref: '#/components/responses/TooManyRequests' },
          '500': { $ref: '#/components/responses/InternalServerError' },
        },
      },
    },
    // ==================== Runs ====================
    '/v1/runs': {
      post: {
        tags: ['Runs'],
        summary: 'Create a new run',
        description: 'Executes an endpoint and returns a run ID for tracking. The execution happens asynchronously - poll GET /v1/runs/{id} for status.',
        operationId: 'createRun',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateRunRequest' },
              example: {
                project_id: '550e8400-e29b-41d4-a716-446655440000',
                version_id: '660e8400-e29b-41d4-a716-446655440001',
                endpoint_id: 'POST_/analyze',
                json: { text: 'Hello world' },
                lane: 'cpu',
                timeout_seconds: 60,
              },
            },
          },
        },
        responses: {
          '202': { description: 'Run created and started', content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateRunResponse' } } } },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '404': { $ref: '#/components/responses/NotFound' },
          '429': { $ref: '#/components/responses/TooManyRequests' },
          '500': { $ref: '#/components/responses/InternalServerError' },
        },
      },
    },
    '/v1/runs/{id}': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' }, description: 'Run ID' }],
      get: {
        tags: ['Runs'],
        summary: 'Get run status and result',
        description: 'Returns the current status and result (if completed) of a run',
        operationId: 'getRun',
        responses: {
          '200': { description: 'Run status and result', content: { 'application/json': { schema: { $ref: '#/components/schemas/Run' } } } },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '404': { $ref: '#/components/responses/NotFound' },
          '429': { $ref: '#/components/responses/TooManyRequests' },
          '500': { $ref: '#/components/responses/InternalServerError' },
        },
      },
    },
    // ==================== Health ====================
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        description: 'Simple health check endpoint',
        operationId: 'healthCheck',
        security: [],
        responses: {
          '200': {
            description: 'Service is healthy',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthResponse' },
                example: { status: 'healthy', uptime: 3600.5, timestamp: '2024-01-15T10:30:00Z' },
              },
            },
          },
        },
      },
    },
    '/health/deep': {
      get: {
        tags: ['Health'],
        summary: 'Deep health check',
        description: 'Health check including external dependencies (Supabase, Modal, Sentry)',
        operationId: 'deepHealthCheck',
        security: [],
        responses: {
          '200': { description: 'All systems healthy', content: { 'application/json': { schema: { $ref: '#/components/schemas/DeepHealthResponse' } } } },
          '503': {
            description: 'One or more systems unhealthy',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/DeepHealthResponse' },
                example: {
                  status: 'unhealthy',
                  uptime: 3600.5,
                  timestamp: '2024-01-15T10:30:00Z',
                  checks: {
                    supabase: { status: 'unhealthy', error: 'Connection timeout' },
                    modal: { status: 'configured' },
                    sentry: { status: 'healthy' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/metrics': {
      get: {
        tags: ['Health'],
        summary: 'Prometheus metrics',
        description: 'Returns Prometheus-formatted metrics for monitoring',
        operationId: 'getMetrics',
        security: [],
        responses: {
          '200': {
            description: 'Prometheus metrics',
            content: {
              'text/plain': {
                schema: { type: 'string' },
                example: `# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",path="/health",status="200"} 42`,
              },
            },
          },
        },
      },
    },
    '/v1/openapi.json': {
      get: {
        tags: ['Health'],
        summary: 'OpenAPI specification',
        description: 'Returns the OpenAPI 3.0 specification for this API',
        operationId: 'getOpenAPISpec',
        security: [],
        responses: {
          '200': {
            description: 'OpenAPI specification',
            content: {
              'application/json': {
                schema: { type: 'object', description: 'OpenAPI 3.0 specification document' },
              },
            },
          },
        },
      },
    },
  },
} as const;
