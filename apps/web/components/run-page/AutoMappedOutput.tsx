// ABOUTME: Auto-mapped output renderer - renders JSON data with type-based UI mapping
// ABOUTME: Automatically formats strings, numbers, booleans, arrays, and objects

'use client';

import { useState } from 'react';
import { BooleanBadge } from './BooleanBadge';
import { TagList } from './TagList';
import { CollapsibleCard } from './CollapsibleCard';

interface AutoMappedOutputProps {
  data: unknown;
  schema?: Record<string, unknown>;
  depth?: number;
}

/**
 * Humanize a field name: snake_case/camelCase → Title Case
 */
function humanizeLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Check if a string looks like a URL
 */
function isUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Get a short preview of an object for collapsed cards
 */
function getObjectPreview(obj: Record<string, unknown>): string {
  const keys = Object.keys(obj);
  if (keys.length === 0) return '{}';
  if (keys.length <= 2) {
    return keys.map((k) => `${k}: ${summarizeValue(obj[k])}`).join(', ');
  }
  return `${keys.length} fields`;
}

/**
 * Get a short summary of a value for previews
 */
function summarizeValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') {
    return value.length > 30 ? `"${value.substring(0, 30)}..."` : `"${value}"`;
  }
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return `[${value.length}]`;
  if (typeof value === 'object') return '{...}';
  return String(value);
}

/**
 * Format a number with locale-aware formatting
 */
function formatNumber(num: number): string {
  if (Number.isInteger(num)) {
    return num.toLocaleString();
  }
  return num.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

/**
 * Copy value to clipboard
 */
function copyToClipboard(value: unknown) {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  navigator.clipboard.writeText(text);
}

/**
 * Render a single value based on its type
 */
function ValueRenderer({
  value,
  fieldKey,
  depth = 0,
}: {
  value: unknown;
  fieldKey?: string;
  depth?: number;
}) {
  const [showCopy, setShowCopy] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    copyToClipboard(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Null/undefined
  if (value === null || value === undefined) {
    return <span className="text-[var(--text-tertiary)]">—</span>;
  }

  // Boolean
  if (typeof value === 'boolean') {
    return <BooleanBadge value={value} />;
  }

  // Number
  if (typeof value === 'number') {
    return (
      <span
        className="font-mono text-[var(--accent)] cursor-pointer"
        onMouseEnter={() => setShowCopy(true)}
        onMouseLeave={() => setShowCopy(false)}
        onClick={handleCopy}
        title="Click to copy"
      >
        {formatNumber(value)}
        {showCopy && (
          <span className="ml-1 text-[10px] text-[var(--text-tertiary)]">
            {copied ? '✓' : 'copy'}
          </span>
        )}
      </span>
    );
  }

  // String
  if (typeof value === 'string') {
    // URL - render as link
    if (isUrl(value)) {
      return (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--accent)] hover:underline break-all"
        >
          {value}
        </a>
      );
    }

    // Regular string
    return (
      <span
        className="text-[var(--text-primary)] break-words cursor-pointer"
        onMouseEnter={() => setShowCopy(true)}
        onMouseLeave={() => setShowCopy(false)}
        onClick={handleCopy}
        title="Click to copy"
      >
        {value}
        {showCopy && (
          <span className="ml-1 text-[10px] text-[var(--text-tertiary)]">
            {copied ? '✓' : 'copy'}
          </span>
        )}
      </span>
    );
  }

  // Array
  if (Array.isArray(value)) {
    // Empty array
    if (value.length === 0) {
      return <span className="text-[var(--text-tertiary)]">[ ]</span>;
    }

    // Array of strings - render as tags
    if (value.every((item) => typeof item === 'string')) {
      return <TagList tags={value as string[]} />;
    }

    // Array of primitives - render inline
    if (value.every((item) => typeof item !== 'object' || item === null)) {
      return (
        <div className="flex flex-wrap gap-1.5">
          {value.map((item, index) => (
            <span
              key={index}
              className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border)]"
            >
              {item === null ? '—' : String(item)}
            </span>
          ))}
        </div>
      );
    }

    // Array of objects - render as collapsible list
    return (
      <div className="space-y-2">
        {value.map((item, index) => (
          <CollapsibleCard
            key={index}
            label={`Item ${index + 1}`}
            preview={typeof item === 'object' && item ? getObjectPreview(item as Record<string, unknown>) : undefined}
          >
            <AutoMappedOutput data={item} depth={depth + 1} />
          </CollapsibleCard>
        ))}
      </div>
    );
  }

  // Object
  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);

    if (keys.length === 0) {
      return <span className="text-[var(--text-tertiary)]">{ }</span>;
    }

    // Nested object - render as collapsible if not at root
    if (depth > 0) {
      return (
        <CollapsibleCard
          label={fieldKey ? humanizeLabel(fieldKey) : 'Object'}
          preview={getObjectPreview(obj)}
        >
          <AutoMappedOutput data={obj} depth={depth + 1} />
        </CollapsibleCard>
      );
    }

    // Root level - render fields directly
    return <AutoMappedOutput data={obj} depth={depth} />;
  }

  // Fallback for unknown types
  return <span className="text-[var(--text-primary)]">{String(value)}</span>;
}

/**
 * Main AutoMappedOutput component
 */
export function AutoMappedOutput({ data, schema, depth = 0 }: AutoMappedOutputProps) {
  // Handle primitives at root level
  if (typeof data !== 'object' || data === null) {
    return <ValueRenderer value={data} depth={depth} />;
  }

  // Handle arrays at root level
  if (Array.isArray(data)) {
    return <ValueRenderer value={data} depth={depth} />;
  }

  // Object - render as labeled fields
  const obj = data as Record<string, unknown>;
  const keys = Object.keys(obj);

  if (keys.length === 0) {
    return <span className="text-[var(--text-tertiary)]">Empty object</span>;
  }

  return (
    <div className="space-y-3">
      {keys.map((key) => {
        const value = obj[key];
        const isNestedObject =
          typeof value === 'object' &&
          value !== null &&
          !Array.isArray(value) &&
          Object.keys(value).length > 0;
        const isNestedArray =
          Array.isArray(value) &&
          value.length > 0 &&
          value.some((item) => typeof item === 'object' && item !== null);

        return (
          <div key={key} className="group">
            {isNestedObject || isNestedArray ? (
              <CollapsibleCard
                label={humanizeLabel(key)}
                preview={
                  Array.isArray(value)
                    ? `${value.length} items`
                    : getObjectPreview(value as Record<string, unknown>)
                }
              >
                <AutoMappedOutput data={value} depth={depth + 1} />
              </CollapsibleCard>
            ) : (
              <div className="flex items-start gap-3">
                <span className="text-xs font-medium text-[var(--text-tertiary)] min-w-[120px] pt-0.5 flex-shrink-0">
                  {humanizeLabel(key)}
                </span>
                <div className="flex-1 text-sm">
                  <ValueRenderer value={value} fieldKey={key} depth={depth} />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
