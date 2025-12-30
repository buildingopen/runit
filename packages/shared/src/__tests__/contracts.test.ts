// ABOUTME: Contract validation tests ensuring type safety and completeness
// ABOUTME: Verifies all contract interfaces are properly defined and exportable

import { describe, it, expect } from 'vitest';
import * as contracts from '../contracts';
import * as types from '../types';

describe('Contracts - Runner API', () => {
  it('should export BuildRequest interface', () => {
    const buildRequest: contracts.BuildRequest = {
      version_id: 'test-version-id',
      code_bundle_ref: 's3://bucket/bundle.zip',
      entrypoint: 'main:app',
    };

    expect(buildRequest.version_id).toBe('test-version-id');
    expect(buildRequest.code_bundle_ref).toBe('s3://bucket/bundle.zip');
    expect(buildRequest.entrypoint).toBe('main:app');
  });

  it('should export BuildResponse interface', () => {
    const buildResponse: contracts.BuildResponse = {
      build_id: 'build-123',
      version_hash: 'abc123def456',
      deps_hash: 'dep789xyz',
      base_image_version: '2024-12-30',
      status: 'ready',
    };

    expect(buildResponse.status).toBe('ready');
    expect(buildResponse.build_id).toBe('build-123');
  });

  it('should handle BuildResponse with error', () => {
    const buildResponse: contracts.BuildResponse = {
      build_id: 'build-123',
      version_hash: 'abc123',
      deps_hash: 'dep456',
      base_image_version: '2024-12-30',
      status: 'failed',
      error: 'Dependency installation failed',
    };

    expect(buildResponse.status).toBe('failed');
    expect(buildResponse.error).toBe('Dependency installation failed');
  });

  it('should export GetOpenAPIRequest interface', () => {
    const request: contracts.GetOpenAPIRequest = {
      build_id: 'build-123',
    };

    expect(request.build_id).toBe('build-123');
  });

  it('should export GetOpenAPIResponse interface', () => {
    const response: contracts.GetOpenAPIResponse = {
      build_id: 'build-123',
      openapi: { openapi: '3.1.0', info: { title: 'Test API', version: '1.0.0' }, paths: {} },
      endpoints: [
        {
          id: 'post-extract-company',
          method: 'POST',
          path: '/extract_company',
          summary: 'Extract company information',
          requires_gpu: false,
        },
      ],
    };

    expect(response.endpoints).toHaveLength(1);
    expect(response.endpoints[0].method).toBe('POST');
  });

  it('should export RunEndpointRequest interface', () => {
    const request: contracts.RunEndpointRequest = {
      run_id: 'run-123',
      build_id: 'build-456',
      endpoint_id: 'post-extract-company',
      request_data: {
        params: { limit: 10 },
        json: { url: 'https://example.com' },
        headers: { 'content-type': 'application/json' },
        files: [
          {
            name: 'test.txt',
            content: 'base64-encoded-content',
            mime: 'text/plain',
          },
        ],
      },
      secrets_ref: 'kms://encrypted-secrets',
      context_ref: 's3://bucket/context.json',
      lane: 'cpu',
      timeout_seconds: 60,
      max_memory_mb: 4096,
    };

    expect(request.lane).toBe('cpu');
    expect(request.timeout_seconds).toBe(60);
    expect(request.request_data.files).toHaveLength(1);
  });

  it('should export RunEndpointResponse interface with success', () => {
    const response: contracts.RunEndpointResponse = {
      run_id: 'run-123',
      status: 'success',
      http_status: 200,
      http_headers: { 'content-type': 'application/json' },
      response_body: { name: 'ACME Inc', industry: 'SaaS' },
      duration_ms: 2340,
      base_image_version: '2024-12-30',
      artifacts: [
        {
          name: 'company.csv',
          size: 1024,
          mime: 'text/csv',
          storage_ref: 's3://bucket/artifacts/company.csv',
        },
      ],
    };

    expect(response.status).toBe('success');
    expect(response.http_status).toBe(200);
    expect(response.artifacts).toHaveLength(1);
  });

  it('should export RunEndpointResponse interface with error', () => {
    const response: contracts.RunEndpointResponse = {
      run_id: 'run-123',
      status: 'error',
      http_status: 500,
      http_headers: {},
      response_body: null,
      duration_ms: 1500,
      base_image_version: '2024-12-30',
      artifacts: [],
      logs: 'Traceback...',
      error_class: 'RUNTIME_CRASH',
      error_detail: 'Full stack trace here',
      error_message: 'The endpoint encountered an error',
      suggested_fix: 'Check your code for exceptions',
    };

    expect(response.status).toBe('error');
    expect(response.error_class).toBe('RUNTIME_CRASH');
    expect(response.suggested_fix).toBe('Check your code for exceptions');
  });

  it('should export RunEndpointResponse interface with timeout', () => {
    const response: contracts.RunEndpointResponse = {
      run_id: 'run-123',
      status: 'timeout',
      http_status: 504,
      http_headers: {},
      response_body: null,
      duration_ms: 60000,
      base_image_version: '2024-12-30',
      artifacts: [],
      error_class: 'TIMEOUT',
      error_message: 'This run timed out',
      suggested_fix: 'Try reducing the workload or using GPU lane',
    };

    expect(response.status).toBe('timeout');
    expect(response.duration_ms).toBe(60000);
  });

  it('should export GetRunRequest interface', () => {
    const request: contracts.GetRunRequest = {
      run_id: 'run-123',
    };

    expect(request.run_id).toBe('run-123');
  });

  it('should export GetRunResponse interface', () => {
    const response: contracts.GetRunResponse = {
      run: {
        run_id: 'run-123',
        status: 'success',
        http_status: 200,
        http_headers: {},
        response_body: { result: 'ok' },
        duration_ms: 2000,
        base_image_version: '2024-12-30',
        artifacts: [],
      },
      repro_bundle: {
        run_id: 'run-123',
        project_id: 'proj-456',
        project_version: 'abc123',
        base_image_version: '2024-12-30',
        deps_hash: 'dep789',
        installed_packages: [
          { name: 'fastapi', version: '0.104.1' },
          { name: 'pydantic', version: '2.5.0' },
        ],
        endpoint: 'POST /extract_company',
        method: 'POST',
        path: '/extract_company',
        request_params: {},
        request_body: { url: 'https://example.com' },
        request_headers: {},
        context_refs: ['s3://bucket/context.json'],
        resource_lane: 'cpu',
        timeout_seconds: 60,
        max_memory_mb: 4096,
        status: 'success',
        duration_ms: 2000,
        created_at: '2024-12-30T12:34:56Z',
      },
    };

    expect(response.run.status).toBe('success');
    expect(response.repro_bundle).toBeDefined();
    expect(response.repro_bundle?.installed_packages).toHaveLength(2);
  });

  it('should export ReproBundle interface', () => {
    const bundle: contracts.ReproBundle = {
      run_id: 'run-123',
      project_id: 'proj-456',
      project_version: 'abc123',
      base_image_version: '2024-12-30',
      deps_hash: 'dep789',
      installed_packages: [],
      endpoint: 'POST /test',
      method: 'POST',
      path: '/test',
      request_params: {},
      request_body: {},
      request_headers: {},
      context_refs: [],
      resource_lane: 'cpu',
      timeout_seconds: 60,
      max_memory_mb: 4096,
      status: 'success',
      duration_ms: 1000,
      created_at: '2024-12-30T12:00:00Z',
    };

    expect(bundle.resource_lane).toBe('cpu');
    expect(bundle.installed_packages).toEqual([]);
  });
});

describe('Types - RunEnvelope', () => {
  it('should export RunEnvelope interface with JSON response', () => {
    const envelope: types.RunEnvelope = {
      run_id: 'run-123',
      status: 'success',
      duration_ms: 2340,
      http_status: 200,
      content_type: 'application/json',
      json: { name: 'ACME Inc', industry: 'SaaS' },
      artifacts: [
        {
          name: 'company.csv',
          size: 1024,
          mime: 'text/csv',
          url: 'https://signed-url.example.com/company.csv',
        },
      ],
      warnings: [],
      redactions_applied: false,
      version_hash: 'abc123',
      base_image_version: '2024-12-30',
    };

    expect(envelope.status).toBe('success');
    expect(envelope.content_type).toBe('application/json');
    expect(envelope.json).toBeDefined();
  });

  it('should export RunEnvelope interface with text response', () => {
    const envelope: types.RunEnvelope = {
      run_id: 'run-123',
      status: 'success',
      duration_ms: 1500,
      http_status: 200,
      content_type: 'text/plain',
      text_preview: 'This is a text response...',
      artifacts: [],
      warnings: ['Large response truncated to 10KB'],
      redactions_applied: false,
      version_hash: 'abc123',
      base_image_version: '2024-12-30',
    };

    expect(envelope.content_type).toBe('text/plain');
    expect(envelope.text_preview).toBe('This is a text response...');
    expect(envelope.warnings).toHaveLength(1);
  });

  it('should export RunEnvelope interface with error', () => {
    const envelope: types.RunEnvelope = {
      run_id: 'run-123',
      status: 'error',
      duration_ms: 1000,
      http_status: 500,
      content_type: 'application/json',
      artifacts: [],
      warnings: [],
      redactions_applied: false,
      version_hash: 'abc123',
      base_image_version: '2024-12-30',
      error_class: 'RUNTIME_CRASH',
      error_message: 'The endpoint encountered an error',
      suggested_fix: 'Check your code for exceptions',
    };

    expect(envelope.status).toBe('error');
    expect(envelope.error_class).toBe('RUNTIME_CRASH');
  });

  it('should export RunEnvelope interface with redactions', () => {
    const envelope: types.RunEnvelope = {
      run_id: 'run-123',
      status: 'success',
      duration_ms: 2000,
      http_status: 200,
      content_type: 'application/json',
      json: { api_key: '[REDACTED]', result: 'ok' },
      artifacts: [],
      warnings: ['Sensitive values were redacted from this output'],
      redactions_applied: true,
      version_hash: 'abc123',
      base_image_version: '2024-12-30',
    };

    expect(envelope.redactions_applied).toBe(true);
    expect(envelope.warnings).toContain('Sensitive values were redacted from this output');
  });

  it('should export Artifact interface', () => {
    const artifact: types.Artifact = {
      name: 'output.pdf',
      size: 2048576,
      mime: 'application/pdf',
      url: 'https://signed-url.example.com/output.pdf',
    };

    expect(artifact.size).toBe(2048576);
    expect(artifact.mime).toBe('application/pdf');
  });
});

describe('Types - OpenAPI', () => {
  it('should export OpenAPISchema interface', () => {
    const schema: types.OpenAPISchema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'integer', minimum: 0 },
      },
      required: ['name'],
    };

    expect(schema.type).toBe('object');
    expect(schema.properties).toBeDefined();
    expect(schema.required).toEqual(['name']);
  });

  it('should export OpenAPIParameter interface', () => {
    const param: types.OpenAPIParameter = {
      name: 'limit',
      in: 'query',
      description: 'Maximum number of results',
      required: false,
      schema: { type: 'integer', default: 10, minimum: 1, maximum: 100 },
    };

    expect(param.in).toBe('query');
    expect(param.required).toBe(false);
  });

  it('should export OpenAPIOperation interface', () => {
    const operation: types.OpenAPIOperation = {
      operationId: 'extractCompany',
      summary: 'Extract company information',
      description: 'Fetches and extracts structured company data from a URL',
      parameters: [
        {
          name: 'url',
          in: 'query',
          required: true,
          schema: { type: 'string', format: 'uri' },
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                url: { type: 'string' },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Success',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  industry: { type: 'string' },
                },
              },
            },
          },
        },
      },
      tags: ['extraction'],
    };

    expect(operation.operationId).toBe('extractCompany');
    expect(operation.parameters).toHaveLength(1);
    expect(operation.responses['200']).toBeDefined();
  });

  it('should export OpenAPIEndpointMeta interface', () => {
    const meta: types.OpenAPIEndpointMeta = {
      id: 'post-extract-company',
      method: 'POST',
      path: '/extract_company',
      summary: 'Extract company information',
      requires_gpu: false,
      schema: {
        responses: {
          '200': {
            description: 'Success',
          },
        },
      },
    };

    expect(meta.method).toBe('POST');
    expect(meta.requires_gpu).toBe(false);
  });
});

describe('Package exports', () => {
  it('should export CONTRACTS_VERSION', () => {
    expect(contracts.CONTRACTS_VERSION).toBe('1.0.0');
  });

  it('should export TYPES_VERSION', () => {
    expect(types.TYPES_VERSION).toBe('1.0.0');
  });
});
