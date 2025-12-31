/**
 * Error Taxonomy for OpenAPI Extraction
 *
 * ABOUTME: Defines error classes and structured error responses
 * ABOUTME: Used to classify and provide actionable error messages
 */

export type ErrorClass =
  | 'import_error'           // Can't import user code
  | 'no_fastapi_app'        // No FastAPI app found
  | 'schema_extraction_failed'  // OpenAPI extraction failed
  | 'timeout'               // Import took >30s
  | 'dependency_missing'    // Missing required package
  | 'syntax_error'          // User code has Python syntax errors
  | 'circular_import'       // Circular import detected
  | 'entrypoint_not_found'; // Couldn't find FastAPI app

export interface ClassifiedError {
  error_class: ErrorClass;
  error_message: string;
  suggested_fix: string;
  technical_details?: string;
}

/**
 * Suggested fixes for each error class
 */
export const ERROR_FIXES: Record<ErrorClass, string> = {
  import_error:
    'Check that all imports in your code are valid and dependencies are in requirements.txt',

  no_fastapi_app:
    'Create a FastAPI instance: app = FastAPI(). Common patterns: main:app, app:app, api:app',

  schema_extraction_failed:
    'Ensure your FastAPI app can be instantiated without errors. Check startup/lifespan events',

  timeout:
    'Import took too long (>30s). Move heavy initialization to lazy-loaded functions or endpoints',

  dependency_missing:
    'Add the missing package to requirements.txt with a pinned version',

  syntax_error:
    'Fix Python syntax errors in your code. Test locally with: python -m py_compile <file>',

  circular_import:
    'Restructure your code to avoid circular imports. Consider lazy imports or dependency injection',

  entrypoint_not_found:
    'Rename your file to main.py and export app = FastAPI(), or create executionlayer.toml with: entrypoint = "your_module:app"'
};

/**
 * User-friendly error messages
 */
export const ERROR_MESSAGES: Record<ErrorClass, string> = {
  import_error: 'Could not import your FastAPI application',
  no_fastapi_app: 'No FastAPI app instance found in your code',
  schema_extraction_failed: 'Failed to extract OpenAPI schema from your app',
  timeout: 'Import timeout - application startup took too long',
  dependency_missing: 'Required Python package is missing',
  syntax_error: 'Python syntax error in your code',
  circular_import: 'Circular import detected in your code',
  entrypoint_not_found: 'Could not find FastAPI app entrypoint'
};
