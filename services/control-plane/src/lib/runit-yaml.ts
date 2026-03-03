// ABOUTME: Parser and types for runit.yaml project configuration files.
// ABOUTME: Validates and merges declared schemas over auto-detected endpoints.

import YAML from 'yaml';

/**
 * JSON Schema-like type definition for endpoint inputs/outputs.
 */
export interface SchemaDefinition {
  type: string;
  description?: string;
  required?: string[];
  properties?: Record<string, SchemaProperty>;
  items?: SchemaProperty;
  enum?: string[];
  default?: unknown;
}

export interface SchemaProperty {
  type: string;
  description?: string;
  enum?: string[];
  default?: unknown;
  items?: SchemaProperty;
  properties?: Record<string, SchemaProperty>;
  required?: string[];
}

/**
 * Endpoint declaration in runit.yaml.
 */
export interface RunitEndpointConfig {
  description?: string;
  summary?: string;
  inputs?: SchemaDefinition;
  outputs?: SchemaDefinition;
  lane?: 'cpu' | 'gpu';
  timeout_seconds?: number;
}

/**
 * Secret declaration in runit.yaml.
 */
export interface RunitSecretConfig {
  description?: string;
  required?: boolean;
}

/**
 * Full runit.yaml configuration.
 */
export interface RunitConfig {
  name?: string;
  version?: number | string;
  runtime?: string;
  entrypoint?: string;

  endpoints?: Record<string, RunitEndpointConfig>;

  secrets?: string[] | Record<string, RunitSecretConfig>;

  network?: boolean;

  dependencies?: string[];
}

/**
 * Parse and validate a runit.yaml string.
 * Returns null if the string is empty or invalid YAML.
 */
export function parseRunitYaml(content: string): RunitConfig | null {
  if (!content || !content.trim()) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = YAML.parse(content);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== 'object') {
    return null;
  }

  const raw = parsed as Record<string, unknown>;
  const config: RunitConfig = {};

  // name
  if (typeof raw.name === 'string') {
    config.name = raw.name;
  }

  // version
  if (typeof raw.version === 'number' || typeof raw.version === 'string') {
    config.version = raw.version;
  }

  // runtime
  if (typeof raw.runtime === 'string') {
    config.runtime = raw.runtime;
  }

  // entrypoint
  if (typeof raw.entrypoint === 'string') {
    config.entrypoint = raw.entrypoint;
  }

  // endpoints
  if (raw.endpoints && typeof raw.endpoints === 'object' && !Array.isArray(raw.endpoints)) {
    config.endpoints = {};
    for (const [key, value] of Object.entries(raw.endpoints as Record<string, unknown>)) {
      if (value && typeof value === 'object') {
        config.endpoints[normalizeEndpointKey(key)] = parseEndpointConfig(value as Record<string, unknown>);
      }
    }
  }

  // secrets
  if (Array.isArray(raw.secrets)) {
    config.secrets = raw.secrets.filter((s): s is string => typeof s === 'string');
  } else if (raw.secrets && typeof raw.secrets === 'object') {
    config.secrets = {};
    for (const [key, value] of Object.entries(raw.secrets as Record<string, unknown>)) {
      if (value && typeof value === 'object') {
        const sec = value as Record<string, unknown>;
        (config.secrets as Record<string, RunitSecretConfig>)[key] = {
          description: typeof sec.description === 'string' ? sec.description : undefined,
          required: typeof sec.required === 'boolean' ? sec.required : true,
        };
      } else {
        (config.secrets as Record<string, RunitSecretConfig>)[key] = { required: true };
      }
    }
  }

  // network
  if (typeof raw.network === 'boolean') {
    config.network = raw.network;
  }

  // dependencies
  if (Array.isArray(raw.dependencies)) {
    config.dependencies = raw.dependencies.filter((d): d is string => typeof d === 'string');
  }

  return config;
}

/**
 * Normalize endpoint keys to "METHOD /path" format.
 * Accepts: "generate", "POST /generate", "post /generate", "/generate"
 */
function normalizeEndpointKey(key: string): string {
  const trimmed = key.trim();

  // Already has method prefix: "POST /foo"
  const methodMatch = trimmed.match(/^(GET|POST|PUT|DELETE|PATCH)\s+(\/.*)$/i);
  if (methodMatch) {
    return `${methodMatch[1].toUpperCase()} ${methodMatch[2]}`;
  }

  // Just a path: "/foo"
  if (trimmed.startsWith('/')) {
    return trimmed;
  }

  // Just a name: "generate" -> "/generate"
  return `/${trimmed}`;
}

function parseEndpointConfig(raw: Record<string, unknown>): RunitEndpointConfig {
  const config: RunitEndpointConfig = {};

  if (typeof raw.description === 'string') config.description = raw.description;
  if (typeof raw.summary === 'string') config.summary = raw.summary;
  if (raw.inputs && typeof raw.inputs === 'object') config.inputs = raw.inputs as SchemaDefinition;
  if (raw.outputs && typeof raw.outputs === 'object') config.outputs = raw.outputs as SchemaDefinition;
  if (raw.lane === 'cpu' || raw.lane === 'gpu') config.lane = raw.lane;
  if (typeof raw.timeout_seconds === 'number') config.timeout_seconds = raw.timeout_seconds;

  return config;
}

/**
 * Get the list of required secret names from a RunitConfig.
 */
export function getRequiredSecrets(config: RunitConfig): string[] {
  if (!config.secrets) return [];

  if (Array.isArray(config.secrets)) {
    return config.secrets;
  }

  return Object.entries(config.secrets)
    .filter(([, v]) => v.required !== false)
    .map(([k]) => k);
}

/**
 * Match a runit.yaml endpoint key to a detected endpoint.
 * Handles: "POST /foo" matches endpoint with method=POST path=/foo,
 *          "/foo" matches any method at path /foo,
 *          "foo" matches path /foo.
 */
export function matchEndpoint(
  configKey: string,
  endpoint: { method: string; path: string },
): boolean {
  const normalized = normalizeEndpointKey(configKey);

  // "POST /foo" - match method + path
  const methodMatch = normalized.match(/^(GET|POST|PUT|DELETE|PATCH)\s+(\/.*)$/i);
  if (methodMatch) {
    return (
      endpoint.method.toUpperCase() === methodMatch[1].toUpperCase() &&
      endpoint.path === methodMatch[2]
    );
  }

  // "/foo" - match path only
  return endpoint.path === normalized;
}
