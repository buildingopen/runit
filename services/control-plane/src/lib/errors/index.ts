/**
 * Error Handling - Public API
 *
 * ABOUTME: Main exports for error taxonomy and classification
 */

export {
  type ErrorClass,
  type ClassifiedError,
  ERROR_FIXES,
  ERROR_MESSAGES
} from './taxonomy.js';

export {
  classifyError,
  extractMissingPackage,
  extractSyntaxErrorLocation
} from './classifier.js';
