// ABOUTME: Skeleton loading placeholders with pulse animation
// ABOUTME: Simple div-based, uses CSS variables for theme consistency

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div className={`animate-pulse bg-[var(--bg-tertiary)] rounded ${className}`} />
  );
}

export function SkeletonText({ className = '' }: SkeletonProps) {
  return <Skeleton className={`h-4 ${className}`} />;
}

export function SkeletonTitle({ className = '' }: SkeletonProps) {
  return <Skeleton className={`h-6 w-3/4 ${className}`} />;
}

export function SkeletonCard({ className = '' }: SkeletonProps) {
  return <Skeleton className={`h-24 ${className}`} />;
}
