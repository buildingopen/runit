// ABOUTME: Tag list component - renders arrays of strings as horizontal tag chips
// ABOUTME: Used for displaying string arrays in a compact, readable format

'use client';

interface TagListProps {
  tags: string[];
  maxVisible?: number;
}

export function TagList({ tags, maxVisible = 5 }: TagListProps) {
  const visibleTags = tags.slice(0, maxVisible);
  const remainingCount = tags.length - maxVisible;

  return (
    <div className="flex flex-wrap gap-1.5">
      {visibleTags.map((tag, index) => (
        <span
          key={index}
          className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border)]"
        >
          {tag}
        </span>
      ))}
      {remainingCount > 0 && (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] border border-[var(--border)]">
          +{remainingCount} more
        </span>
      )}
    </div>
  );
}
