/**
 * Error Classifier
 *
 * ABOUTME: Parses Python tracebacks and classifies errors
 * ABOUTME: Maps error patterns to ErrorClass with suggested fixes
 */

import {
  ErrorClass,
  ClassifiedError,
  ERROR_FIXES,
  ERROR_MESSAGES
} from './taxonomy';

/**
 * Error patterns for classification
 */
const ERROR_PATTERNS: Array<{ pattern: RegExp; error_class: ErrorClass }> = [
  // Timeout
  { pattern: /timeout|timed out|exceeded.*seconds/i, error_class: 'timeout' },

  // Circular imports (must be before generic import_error)
  {
    pattern: /circular import|partially initialized module/i,
    error_class: 'circular_import'
  },

  // Import errors
  {
    pattern: /ModuleNotFoundError|ImportError|cannot import name/i,
    error_class: 'import_error'
  },

  // Syntax errors
  {
    pattern: /SyntaxError|invalid syntax/i,
    error_class: 'syntax_error'
  },

  // Missing dependencies
  {
    pattern: /No module named|Package .* is not installed/i,
    error_class: 'dependency_missing'
  },

  // No FastAPI app
  {
    pattern: /no attribute.*app|FastAPI.*not found|app.*undefined/i,
    error_class: 'no_fastapi_app'
  },

  // Schema extraction failed
  {
    pattern: /openapi.*failed|schema.*generation.*failed/i,
    error_class: 'schema_extraction_failed'
  },

  // Entrypoint not found
  {
    pattern: /entrypoint.*not found|could not find.*app/i,
    error_class: 'entrypoint_not_found'
  }
];

/**
 * Classify an error from a Python traceback
 */
export function classifyError(errorMessage: string): ClassifiedError {
  // Try pattern matching
  for (const { pattern, error_class } of ERROR_PATTERNS) {
    if (pattern.test(errorMessage)) {
      return {
        error_class,
        error_message: ERROR_MESSAGES[error_class],
        suggested_fix: ERROR_FIXES[error_class],
        technical_details: extractTechnicalDetails(errorMessage)
      };
    }
  }

  // Default: import error (most common)
  return {
    error_class: 'import_error',
    error_message: ERROR_MESSAGES['import_error'],
    suggested_fix: ERROR_FIXES['import_error'],
    technical_details: extractTechnicalDetails(errorMessage)
  };
}

/**
 * Extract key technical details from error message
 */
function extractTechnicalDetails(errorMessage: string): string {
  // Extract last N lines (the most relevant part of traceback)
  const lines = errorMessage.split('\n').filter(line => line.trim());
  const relevantLines = lines.slice(-10); // Last 10 lines

  // Remove sensitive paths but keep module names
  return relevantLines
    .map(line => {
      // Replace absolute paths with relative module names
      return line.replace(/\/.*?\/([^\/\s]+\.py)/g, '$1');
    })
    .join('\n');
}

/**
 * Extract missing package name from error message
 */
export function extractMissingPackage(errorMessage: string): string | null {
  const match = errorMessage.match(/No module named ['"]([^'"]+)['"]/);
  return match ? match[1] : null;
}

/**
 * Extract syntax error location from error message
 */
export function extractSyntaxErrorLocation(
  errorMessage: string
): { file: string; line: number } | null {
  const match = errorMessage.match(/File "([^"]+)", line (\d+)/);
  if (match) {
    return {
      file: match[1].split('/').pop() || match[1], // Just filename
      line: parseInt(match[2], 10)
    };
  }
  return null;
}
