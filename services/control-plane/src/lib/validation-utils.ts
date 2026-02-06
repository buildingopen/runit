/**
 * Validation utility functions for API inputs
 * Provides base64 validation, ZIP validation, and name validation
 */

import AdmZip from 'adm-zip';
import { VALIDATION_LIMITS, VALIDATION_ERRORS } from '../config/validation.js';

/**
 * Validate project name format and length
 */
export function validateProjectName(name: string): { valid: boolean; error?: string } {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Project name is required' };
  }

  if (name.length > VALIDATION_LIMITS.MAX_PROJECT_NAME_LENGTH) {
    return {
      valid: false,
      error: `${VALIDATION_ERRORS.NAME_TOO_LONG} (received: ${name.length} chars)`
    };
  }

  if (!VALIDATION_LIMITS.PROJECT_NAME_PATTERN.test(name)) {
    return { valid: false, error: VALIDATION_ERRORS.INVALID_NAME_FORMAT };
  }

  return { valid: true };
}

/**
 * Validate base64 string format
 */
export function validateBase64(data: string): { valid: boolean; error?: string } {
  if (!data || typeof data !== 'string') {
    return { valid: false, error: 'Data is required' };
  }

  // Check for valid base64 characters
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
  if (!base64Regex.test(data)) {
    return { valid: false, error: VALIDATION_ERRORS.INVALID_BASE64 };
  }

  // Try to decode
  try {
    Buffer.from(data, 'base64');
  } catch {
    return { valid: false, error: VALIDATION_ERRORS.INVALID_BASE64 };
  }

  return { valid: true };
}

/**
 * Validate ZIP file magic bytes (PK signature)
 */
export function validateZipMagicBytes(base64Data: string): { valid: boolean; error?: string } {
  try {
    const buffer = Buffer.from(base64Data, 'base64');

    // ZIP files must have at least 4 bytes for magic number
    if (buffer.length < 4) {
      return { valid: false, error: VALIDATION_ERRORS.INVALID_ZIP };
    }

    // ZIP files start with PK (0x50 0x4B)
    // Local file header: PK\x03\x04
    // Empty archive: PK\x05\x06
    // Spanned archive: PK\x07\x08
    const pk = buffer[0] === 0x50 && buffer[1] === 0x4B;
    const validSignature = pk && (
      (buffer[2] === 0x03 && buffer[3] === 0x04) || // Local file header
      (buffer[2] === 0x05 && buffer[3] === 0x06) || // Empty archive
      (buffer[2] === 0x07 && buffer[3] === 0x08)    // Spanned archive
    );

    if (!validSignature) {
      return { valid: false, error: VALIDATION_ERRORS.INVALID_ZIP };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: VALIDATION_ERRORS.INVALID_ZIP };
  }
}

/**
 * Validate ZIP data size
 */
export function validateZipDataSize(base64Data: string): { valid: boolean; error?: string } {
  // Base64 has ~33% overhead, so estimate decoded size
  const estimatedDecodedSize = Math.ceil(base64Data.length * 0.75);

  if (estimatedDecodedSize > VALIDATION_LIMITS.MAX_ZIP_DATA_SIZE_BYTES) {
    const maxMB = VALIDATION_LIMITS.MAX_ZIP_DATA_SIZE_BYTES / (1024 * 1024);
    return {
      valid: false,
      error: `ZIP data exceeds maximum size of ${maxMB}MB`,
    };
  }

  return { valid: true };
}

/**
 * Validate ZIP decompression is safe (zip bomb protection)
 * Checks compression ratios and total decompressed size to prevent zip bombs
 */
export function validateZipDecompressionSafe(base64Data: string): { valid: boolean; error?: string } {
  const MAX_DECOMPRESSED_SIZE = 500 * 1024 * 1024; // 500MB max decompressed
  const MAX_PER_FILE_RATIO = 100; // Max 100:1 compression ratio per file
  const MAX_OVERALL_RATIO = 50; // Max 50:1 overall compression ratio

  try {
    const buffer = Buffer.from(base64Data, 'base64');
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries();

    let totalUncompressed = 0;
    const compressedSize = buffer.length;

    for (const entry of entries) {
      const uncompressedSize = entry.header.size;
      const entryCompressedSize = entry.header.compressedSize;

      totalUncompressed += uncompressedSize;

      // Check ratio per file (skip if compressed size is 0 to avoid division by zero)
      if (entryCompressedSize > 0 && uncompressedSize > entryCompressedSize * MAX_PER_FILE_RATIO) {
        return { valid: false, error: 'Suspicious compression ratio detected in ZIP entry' };
      }
    }

    // Total uncompressed max
    if (totalUncompressed > MAX_DECOMPRESSED_SIZE) {
      return { valid: false, error: 'ZIP would decompress to more than 500MB' };
    }

    // Overall ratio check (skip if compressed size is 0)
    if (compressedSize > 0 && totalUncompressed > compressedSize * MAX_OVERALL_RATIO) {
      return { valid: false, error: 'Suspicious overall compression ratio in ZIP' };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: 'Failed to analyze ZIP structure' };
  }
}
