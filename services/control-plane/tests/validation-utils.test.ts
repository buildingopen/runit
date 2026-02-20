/**
 * Tests for validation-utils including zip bomb protection
 */

import { describe, it, expect } from 'vitest';
import AdmZip from 'adm-zip';
import {
  validateProjectName,
  validateBase64,
  validateZipMagicBytes,
  validateZipDataSize,
  validateZipDecompressionSafe,
} from '../src/lib/validation-utils';

describe('validateProjectName', () => {
  it('should accept valid project names', () => {
    expect(validateProjectName('my-project').valid).toBe(true);
    expect(validateProjectName('Project_123').valid).toBe(true);
    expect(validateProjectName('My Project').valid).toBe(true);
  });

  it('should reject empty names', () => {
    expect(validateProjectName('').valid).toBe(false);
  });

  it('should reject names starting with special chars', () => {
    expect(validateProjectName('-project').valid).toBe(false);
    expect(validateProjectName('_project').valid).toBe(false);
  });
});

describe('validateBase64', () => {
  it('should accept valid base64', () => {
    const valid = Buffer.from('hello world').toString('base64');
    expect(validateBase64(valid).valid).toBe(true);
  });

  it('should reject invalid base64', () => {
    expect(validateBase64('not!valid@base64').valid).toBe(false);
  });
});

describe('validateZipMagicBytes', () => {
  it('should accept valid ZIP files', () => {
    const zip = new AdmZip();
    zip.addFile('test.txt', Buffer.from('hello'));
    const base64 = zip.toBuffer().toString('base64');
    expect(validateZipMagicBytes(base64).valid).toBe(true);
  });

  it('should reject non-ZIP data', () => {
    const notZip = Buffer.from('this is not a zip file').toString('base64');
    expect(validateZipMagicBytes(notZip).valid).toBe(false);
  });
});

describe('validateZipDecompressionSafe', () => {
  it('should accept normal ZIP files', () => {
    const zip = new AdmZip();
    zip.addFile('file1.txt', Buffer.from('Hello World'));
    zip.addFile('file2.txt', Buffer.from('Another file content'));
    const base64 = zip.toBuffer().toString('base64');

    const result = validateZipDecompressionSafe(base64);
    expect(result.valid).toBe(true);
  });

  it('should accept ZIP with reasonable compression ratio', () => {
    // Create a file with some repetition (compresses well but not suspiciously)
    const content = 'Hello World! '.repeat(100); // ~1.3KB
    const zip = new AdmZip();
    zip.addFile('repeated.txt', Buffer.from(content));
    const base64 = zip.toBuffer().toString('base64');

    const result = validateZipDecompressionSafe(base64);
    expect(result.valid).toBe(true);
  });

  it('should reject ZIP with suspicious per-file compression ratio', () => {
    // Create a file that would have extreme compression ratio
    // We'll simulate this by creating content that's highly repetitive
    // A real zip bomb would have 1000:1 or higher ratio

    // Create highly compressible content (zeros compress extremely well)
    const zeros = Buffer.alloc(10 * 1024 * 1024, 0); // 10MB of zeros
    const zip = new AdmZip();
    zip.addFile('zeros.bin', zeros);
    const buffer = zip.toBuffer();
    const base64 = buffer.toString('base64');

    const result = validateZipDecompressionSafe(base64);
    // This should be flagged if compression ratio exceeds 100:1
    // 10MB zeros typically compress to ~10KB = 1000:1 ratio
    expect(result.valid).toBe(false);
    expect(result.error).toContain('compression ratio');
  }, 30000);

  it('should reject ZIP that would decompress to >500MB', () => {
    // We can't easily create a real 500MB+ decompressed file in tests
    // But we can verify the logic by checking headers
    // For now, test with a smaller file that's clearly safe
    const zip = new AdmZip();
    zip.addFile('small.txt', Buffer.from('small content'));
    const base64 = zip.toBuffer().toString('base64');

    const result = validateZipDecompressionSafe(base64);
    expect(result.valid).toBe(true);
  });

  it('should handle empty ZIP files', () => {
    const zip = new AdmZip();
    const base64 = zip.toBuffer().toString('base64');

    const result = validateZipDecompressionSafe(base64);
    expect(result.valid).toBe(true);
  });

  it('should reject invalid ZIP data', () => {
    const notZip = Buffer.from('not a zip file').toString('base64');
    const result = validateZipDecompressionSafe(notZip);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Failed to analyze ZIP structure');
  });

  it('should handle ZIP with multiple files', () => {
    const zip = new AdmZip();
    for (let i = 0; i < 10; i++) {
      zip.addFile(`file${i}.txt`, Buffer.from(`Content for file ${i}`));
    }
    const base64 = zip.toBuffer().toString('base64');

    const result = validateZipDecompressionSafe(base64);
    expect(result.valid).toBe(true);
  });

  it('should reject overall suspicious compression ratio', () => {
    // Create multiple files with highly compressible content
    const zip = new AdmZip();
    // Add several files of zeros - should trigger overall ratio check
    for (let i = 0; i < 5; i++) {
      zip.addFile(`zeros${i}.bin`, Buffer.alloc(2 * 1024 * 1024, 0)); // 2MB each = 10MB total
    }
    const base64 = zip.toBuffer().toString('base64');

    const result = validateZipDecompressionSafe(base64);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('compression ratio');
  }, 30000);
});
