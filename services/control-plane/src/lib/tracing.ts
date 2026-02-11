/**
 * OpenTelemetry Tracing Configuration
 *
 * Initializes distributed tracing with:
 * - Auto-instrumentation for HTTP and Node.js internals
 * - OTLP exporter for production (configurable via OTEL_EXPORTER_OTLP_ENDPOINT)
 * - Console exporter fallback for development
 * - Custom span helpers for Modal execution and secrets operations
 *
 * IMPORTANT: This module must be imported BEFORE any other imports in main.ts
 * to ensure proper instrumentation of all HTTP clients and servers.
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ConsoleSpanExporter, BatchSpanProcessor, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';
import { trace, SpanStatusCode, Span, SpanKind } from '@opentelemetry/api';

// Service identification
const SERVICE_NAME = 'control-plane';
const SERVICE_VERSION = '0.1.0';

// Environment configuration
const isProduction = process.env.NODE_ENV === 'production';
const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
const tracingEnabled = process.env.OTEL_TRACING_ENABLED !== 'false';

// Create resource with service metadata
const resource = resourceFromAttributes({
  [ATTR_SERVICE_NAME]: SERVICE_NAME,
  [ATTR_SERVICE_VERSION]: SERVICE_VERSION,
  'deployment.environment': isProduction ? 'production' : 'development',
});

// Configure exporter based on environment
function createExporter() {
  if (otlpEndpoint) {
    console.log(`[Tracing] Using OTLP exporter: ${otlpEndpoint}`);
    return new OTLPTraceExporter({
      url: `${otlpEndpoint}/v1/traces`,
      headers: process.env.OTEL_EXPORTER_OTLP_HEADERS
        ? JSON.parse(process.env.OTEL_EXPORTER_OTLP_HEADERS)
        : undefined,
    });
  }

  if (!isProduction) {
    console.log('[Tracing] Using console exporter (development mode)');
    return new ConsoleSpanExporter();
  }

  console.log('[Tracing] No OTEL_EXPORTER_OTLP_ENDPOINT configured, tracing disabled');
  return null;
}

// Initialize SDK
let sdk: NodeSDK | null = null;

export function initTracing(): void {
  if (!tracingEnabled) {
    console.log('[Tracing] Tracing disabled via OTEL_TRACING_ENABLED=false');
    return;
  }

  const exporter = createExporter();

  if (!exporter) {
    return;
  }

  // Use BatchSpanProcessor in production for better performance
  // Use SimpleSpanProcessor in development for immediate visibility
  const spanProcessor = isProduction
    ? new BatchSpanProcessor(exporter)
    : new SimpleSpanProcessor(exporter);

  sdk = new NodeSDK({
    resource,
    spanProcessor,
    instrumentations: [
      getNodeAutoInstrumentations({
        // Enable HTTP instrumentation
        '@opentelemetry/instrumentation-http': {
          enabled: true,
          ignoreIncomingRequestHook: (req) => {
            // Ignore health check requests to reduce noise
            const url = req.url || '';
            return url === '/health' || url === '/metrics';
          },
        },
        // Disable noisy instrumentations
        '@opentelemetry/instrumentation-fs': {
          enabled: false,
        },
        '@opentelemetry/instrumentation-dns': {
          enabled: false,
        },
      }),
    ],
  });

  try {
    sdk.start();
    console.log(`[Tracing] OpenTelemetry initialized for ${SERVICE_NAME}`);
  } catch (error) {
    console.error('[Tracing] Failed to initialize OpenTelemetry:', error);
  }
}

// Graceful shutdown
export async function shutdownTracing(): Promise<void> {
  if (sdk) {
    try {
      await sdk.shutdown();
      console.log('[Tracing] OpenTelemetry shut down gracefully');
    } catch (error) {
      console.error('[Tracing] Error shutting down OpenTelemetry:', error);
    }
  }
}

// Get tracer for creating custom spans
export function getTracer() {
  return trace.getTracer(SERVICE_NAME, SERVICE_VERSION);
}

// ============================================================================
// Custom Span Helpers
// ============================================================================

/**
 * Wrap Modal execution with a traced span
 *
 * Captures:
 * - Run ID
 * - Lane (cpu/gpu)
 * - Endpoint being called
 * - Execution duration
 * - Error details on failure
 */
export async function withModalExecutionSpan<T>(
  runId: string,
  lane: 'cpu' | 'gpu',
  endpoint: string,
  fn: (span: Span) => Promise<T>
): Promise<T> {
  const tracer = getTracer();

  return tracer.startActiveSpan(
    'modal.execute',
    {
      kind: SpanKind.CLIENT,
      attributes: {
        'modal.run_id': runId,
        'modal.lane': lane,
        'modal.endpoint': endpoint,
      },
    },
    async (span) => {
      try {
        const result = await fn(span);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : String(error),
        });
        span.recordException(error instanceof Error ? error : new Error(String(error)));
        throw error;
      } finally {
        span.end();
      }
    }
  );
}

/**
 * Add result attributes to a Modal execution span
 */
export function recordModalResult(
  span: Span,
  status: 'success' | 'error' | 'timeout',
  httpStatus: number,
  durationMs: number,
  errorClass?: string,
  errorMessage?: string
): void {
  span.setAttributes({
    'modal.result.status': status,
    'modal.result.http_status': httpStatus,
    'modal.result.duration_ms': durationMs,
  });

  if (errorClass) {
    span.setAttributes({
      'modal.error.class': errorClass,
    });
  }

  if (errorMessage) {
    span.setAttributes({
      'modal.error.message': errorMessage,
    });
  }
}

/**
 * Wrap secrets encryption with a traced span
 *
 * Captures:
 * - Operation type (encrypt/decrypt)
 * - KMS provider used
 * - Duration
 * - Error on failure
 *
 * NOTE: Never logs secret values or any sensitive data
 */
export async function withSecretsSpan<T>(
  operation: 'encrypt' | 'decrypt',
  secretKey: string | undefined,
  fn: () => Promise<T>
): Promise<T> {
  const tracer = getTracer();

  return tracer.startActiveSpan(
    `secrets.${operation}`,
    {
      kind: SpanKind.INTERNAL,
      attributes: {
        'secrets.operation': operation,
        // Only include key name, never the value
        'secrets.key': secretKey || 'bundle',
      },
    },
    async (span) => {
      try {
        const result = await fn();
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : String(error),
        });
        span.recordException(error instanceof Error ? error : new Error(String(error)));
        throw error;
      } finally {
        span.end();
      }
    }
  );
}

/**
 * Create a custom span for any operation
 */
export async function withSpan<T>(
  name: string,
  attributes: Record<string, string | number | boolean>,
  fn: (span: Span) => Promise<T>
): Promise<T> {
  const tracer = getTracer();

  return tracer.startActiveSpan(
    name,
    { attributes },
    async (span) => {
      try {
        const result = await fn(span);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : String(error),
        });
        span.recordException(error instanceof Error ? error : new Error(String(error)));
        throw error;
      } finally {
        span.end();
      }
    }
  );
}

// Initialize tracing immediately when module is imported
initTracing();
