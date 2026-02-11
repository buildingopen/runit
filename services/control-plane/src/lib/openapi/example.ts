/**
 * OpenAPI Extractor Example Usage
 *
 * ABOUTME: Example demonstrating how to use the OpenAPI extraction system
 */

import { createExtractor } from './extractor';

async function main() {
  // Create extractor instance
  const extractor = createExtractor({
    bridgeUrl: process.env.OPENAPI_BRIDGE_URL || 'http://localhost:8001',
    timeout: 45000,
    importTimeout: 30
  });

  // Check if bridge service is running
  console.log('Checking bridge service health...');
  const isHealthy = await extractor.healthCheck();

  if (!isHealthy) {
    console.error('❌ Python bridge service is not running');
    console.error('Start it with: python services/control-plane/src/lib/openapi/bridge.py');
    process.exit(1);
  }

  console.log('✅ Bridge service is healthy\n');

  // Example: Extract OpenAPI from a project
  const projectPath = process.argv[2] || './tests/openapi/fixtures';

  console.log(`Extracting OpenAPI from: ${projectPath}`);
  console.log('Entrypoint: auto-detect\n');

  const response = await extractor.extract({
    project_id: 'example-project',
    version_id: 'v1',
    zip_path: projectPath
  });

  if (response.error) {
    console.error('❌ Extraction failed\n');
    console.error(`Error class: ${response.error.error_class}`);
    console.error(`Message: ${response.error.error_message}`);
    console.error(`\nSuggested fix:\n${response.error.suggested_fix}`);

    if (response.error.technical_details) {
      console.error(`\nTechnical details:\n${response.error.technical_details}`);
    }

    process.exit(1);
  }

  // Success
  console.log('✅ Extraction successful\n');
  console.log(`Entrypoint: ${response.entrypoint}`);

  if (response.entrypoint_detection) {
    console.log(`Detection method: ${response.entrypoint_detection.detectionMethod}`);
    console.log(`Confidence: ${response.entrypoint_detection.confidence}`);
  }

  console.log(`\nFound ${response.endpoints.length} endpoints:`);

  response.endpoints.forEach((endpoint, i) => {
    console.log(`\n${i + 1}. ${endpoint.method} ${endpoint.path}`);
    if (endpoint.summary) {
      console.log(`   Summary: ${endpoint.summary}`);
    }
    if (endpoint.requires_gpu) {
      console.log(`   🎮 Requires GPU`);
    }
  });

  // Show OpenAPI schema (truncated)
  console.log('\n--- OpenAPI Schema (truncated) ---');
  const schema = response.openapi_schema as Record<string, unknown>;
  const schemaInfo = schema.info as { title?: string; version?: string } | undefined;
  console.log(`Title: ${schemaInfo?.title || 'N/A'}`);
  console.log(`Version: ${schemaInfo?.version || 'N/A'}`);
  console.log(`Paths: ${Object.keys((schema.paths as Record<string, unknown>) || {}).length}`);

  console.log('\n✅ Example completed successfully');
}

// Run example
main().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
