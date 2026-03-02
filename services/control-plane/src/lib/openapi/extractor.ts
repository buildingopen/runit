/**
 * OpenAPI Extractor
 *
 * ABOUTME: Calls Python bridge service to extract OpenAPI schemas from user FastAPI apps
 * ABOUTME: Handles extraction errors and classifies them using error taxonomy
 */

import { classifyError } from '../errors/classifier.js';
import type { ClassifiedError } from '../errors/taxonomy.js';
import {
  detectEntrypoint,
  validateEntrypoint,
  type EntrypointResult
} from './entrypoint-detector.js';

/**
 * Endpoint metadata extracted from OpenAPI schema
 */
export interface EndpointMeta {
  endpoint_id: string;
  method: string;
  path: string;
  summary?: string;
  description?: string;
  requires_gpu?: boolean;
}

/**
 * OpenAPI extraction request
 */
export interface ExtractOpenAPIRequest {
  project_id: string;
  version_id: string;
  zip_path: string; // Path to extracted ZIP
  entrypoint?: string; // Optional custom entrypoint
}

/**
 * OpenAPI extraction response
 */
export interface ExtractOpenAPIResponse {
  openapi_schema: unknown; // OpenAPI 3.1 JSON
  endpoints: EndpointMeta[];
  entrypoint: string; // e.g., "main:app"
  entrypoint_detection?: EntrypointResult;
  error?: ClassifiedError;
}

/**
 * Python bridge response format
 */
interface BridgeResponse {
  openapi_schema: Record<string, unknown>;
  entrypoint: string;
  endpoints: EndpointMeta[];
  success: boolean;
  error?: string;
  error_type?: string;
}

/**
 * Configuration for OpenAPI extractor
 */
export interface ExtractorConfig {
  bridgeUrl: string; // Python bridge service URL
  timeout: number; // Request timeout in ms
  importTimeout: number; // Python import timeout in seconds
}

/**
 * Default extractor configuration
 */
const DEFAULT_CONFIG: ExtractorConfig = {
  bridgeUrl: process.env.OPENAPI_BRIDGE_URL || 'http://localhost:8001',
  timeout: 45000, // 45s total
  importTimeout: 30 // 30s for Python import
};

/**
 * OpenAPI Extractor
 *
 * Loads user FastAPI apps and extracts their OpenAPI schemas
 */
export class OpenAPIExtractor {
  constructor(private config: ExtractorConfig = DEFAULT_CONFIG) {}

  /**
   * Extract OpenAPI schema from a FastAPI project
   */
  async extract(
    request: ExtractOpenAPIRequest
  ): Promise<ExtractOpenAPIResponse> {
    // 1. Detect entrypoint
    let entrypoint: string;
    let entrypointDetection: EntrypointResult | undefined;

    if (request.entrypoint) {
      // Use provided entrypoint
      if (!validateEntrypoint(request.entrypoint)) {
        return {
          openapi_schema: {},
          endpoints: [],
          entrypoint: request.entrypoint,
          error: {
            error_class: 'entrypoint_not_found',
            error_message: 'Invalid entrypoint format',
            suggested_fix:
              'Entrypoint must be in format "module:variable" (e.g., "main:app")',
            technical_details: `Provided: ${request.entrypoint}`
          }
        };
      }
      entrypoint = request.entrypoint;
    } else {
      // Auto-detect entrypoint
      entrypointDetection = await detectEntrypoint(request.zip_path);
      entrypoint = entrypointDetection.entrypoint;
    }

    // 2. Call Python bridge to extract OpenAPI
    try {
      const bridgeResponse = await this.callBridge(
        request.zip_path,
        entrypoint
      );

      if (!bridgeResponse.success && bridgeResponse.error) {
        // Classification and error handling
        const classifiedError = classifyError(bridgeResponse.error);

        return {
          openapi_schema: {},
          endpoints: [],
          entrypoint,
          entrypoint_detection: entrypointDetection,
          error: classifiedError
        };
      }

      // Success
      return {
        openapi_schema: bridgeResponse.openapi_schema,
        endpoints: bridgeResponse.endpoints,
        entrypoint,
        entrypoint_detection: entrypointDetection
      };
    } catch (error) {
      // Network or other errors
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      return {
        openapi_schema: {},
        endpoints: [],
        entrypoint,
        entrypoint_detection: entrypointDetection,
        error: {
          error_class: 'import_error',
          error_message: 'Failed to connect to OpenAPI bridge service',
          suggested_fix:
            'Ensure the Python bridge service is running and accessible',
          technical_details: errorMessage
        }
      };
    }
  }

  /**
   * Call Python bridge service
   */
  private async callBridge(
    zipPath: string,
    entrypoint: string
  ): Promise<BridgeResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(`${this.config.bridgeUrl}/extract-openapi`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          zip_path: zipPath,
          entrypoint,
          timeout_seconds: this.config.importTimeout
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(
          `Bridge service returned ${response.status}: ${response.statusText}`
        );
      }

      const data = (await response.json()) as BridgeResponse;
      return data;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Health check for Python bridge service
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.bridgeUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });

      return response.ok;
    } catch {
      return false;
    }
  }
}

/**
 * Create a new OpenAPI extractor with optional config override
 */
export function createExtractor(
  config?: Partial<ExtractorConfig>
): OpenAPIExtractor {
  return new OpenAPIExtractor({ ...DEFAULT_CONFIG, ...config });
}
