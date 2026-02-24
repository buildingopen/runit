/**
 * Error Taxonomy for App Analysis
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
    'Check that all imports in your code are valid and dependencies are listed in requirements.txt',

  no_fastapi_app:
    'Your main.py needs a FastAPI app (e.g., app = FastAPI()). We look for common names: main:app, app:app, api:app',

  schema_extraction_failed:
    'Make sure your app starts without errors. Check for any code that runs on startup',

  timeout:
    'Your app took too long to start (>30s). Try moving slow setup code inside your functions instead of at the top level',

  dependency_missing:
    'Add the missing package to your requirements.txt file',

  syntax_error:
    'There\'s a syntax error in your Python code. Try running it locally first to check: python -m py_compile your_file.py',

  circular_import:
    'Your code has circular imports (file A imports file B, which imports file A). Try reorganizing your imports',

  entrypoint_not_found:
    'Name your main file main.py with app = FastAPI() inside it. Or create an executionlayer.toml to specify which file to use'
};

/**
 * User-friendly error messages
 */
export const ERROR_MESSAGES: Record<ErrorClass, string> = {
  import_error: 'Could not load your Python app',
  no_fastapi_app: 'No app found in your code',
  schema_extraction_failed: 'Failed to analyze your app',
  timeout: 'Your app took too long to start',
  dependency_missing: 'A required Python package is missing',
  syntax_error: 'Your code has a syntax error',
  circular_import: 'Circular import detected in your code',
  entrypoint_not_found: 'Could not find your app\'s main file'
};
