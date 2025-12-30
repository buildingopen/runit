/**
 * ABOUTME: Platform-side URL scraper for context fetching
 * ABOUTME: Extracts metadata from URLs using static HTML parsing
 */

import { FetchContextResponse } from '../../../packages/shared/src/types';

const FORBIDDEN_CONTEXT_KEYS = [
  /.*_KEY$/i,
  /.*_TOKEN$/i,
  /.*_SECRET$/i,
  /^PASSWORD/i,
  /^API_KEY/i,
  /^SECRET/i,
];

export interface ContextValidationError {
  key: string;
  reason: string;
}

/**
 * Validate context data to ensure it doesn't contain secrets
 */
export function validateContext(context: Record<string, any>): ContextValidationError[] {
  const errors: ContextValidationError[] = [];

  function checkKeys(obj: Record<string, any>, prefix = ''): void {
    for (const key in obj) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      // Check if key matches forbidden patterns
      for (const pattern of FORBIDDEN_CONTEXT_KEYS) {
        if (pattern.test(key)) {
          errors.push({
            key: fullKey,
            reason: `Context key '${key}' looks like a secret. Use Secrets instead.`,
          });
          break;
        }
      }

      // Recursively check nested objects
      if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
        checkKeys(obj[key], fullKey);
      }
    }
  }

  checkKeys(context);
  return errors;
}

/**
 * Fetch and extract context from a URL
 * v0: Simple HTML parsing with BeautifulSoup-like extraction
 */
export async function fetchContextFromURL(url: string, name: string): Promise<FetchContextResponse> {
  // Validate URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('Only HTTP and HTTPS URLs are supported');
    }
  } catch (error) {
    throw new Error(`Invalid URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Fetch HTML with timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'ExecutionLayer/1.0 (+https://executionlayer.com/bot)',
      },
      redirect: 'follow',
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();

    // Extract metadata using simple HTML parsing
    const metadata = extractMetadata(html, url);

    // Validate extracted data doesn't contain secrets
    const validationErrors = validateContext(metadata);
    if (validationErrors.length > 0) {
      throw new Error(
        `Context validation failed: ${validationErrors.map((e) => e.reason).join(', ')}`
      );
    }

    const now = new Date().toISOString();

    return {
      id: crypto.randomUUID(),
      name,
      data: {
        title: metadata.title,
        description: metadata.description,
        url,
        fetched_at: now,
      },
    };
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timed out (10s limit)');
      }
      throw error;
    }
    throw new Error('Unknown error occurred while fetching URL');
  }
}

/**
 * Extract metadata from HTML using simple parsing
 * v0: Title, description, and basic OpenGraph support
 */
function extractMetadata(
  html: string,
  url: string
): { title?: string; description?: string } {
  const metadata: { title?: string; description?: string } = {};

  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch && titleMatch[1]) {
    metadata.title = titleMatch[1].trim().slice(0, 200);
  }

  // Try OpenGraph title first
  const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
  if (ogTitleMatch && ogTitleMatch[1]) {
    metadata.title = ogTitleMatch[1].trim().slice(0, 200);
  }

  // Extract description
  const descMatch = html.match(
    /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i
  );
  if (descMatch && descMatch[1]) {
    metadata.description = descMatch[1].trim().slice(0, 1000);
  }

  // Try OpenGraph description
  const ogDescMatch = html.match(
    /<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i
  );
  if (ogDescMatch && ogDescMatch[1]) {
    metadata.description = ogDescMatch[1].trim().slice(0, 1000);
  }

  return metadata;
}
