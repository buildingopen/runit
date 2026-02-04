export default function Loading() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] animate-pulse">
      {/* Header skeleton */}
      <div className="h-12 bg-[var(--bg-secondary)] border-b border-[var(--border-subtle)] flex items-center px-6 gap-4">
        <div className="h-5 w-24 bg-[var(--bg-hover)] rounded" />
        <div className="ml-auto h-5 w-16 bg-[var(--bg-hover)] rounded" />
      </div>

      {/* Content skeleton */}
      <div className="p-6">
        {/* Title */}
        <div className="h-7 w-48 bg-[var(--bg-hover)] rounded mb-6" />

        {/* Cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-[140px] bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg p-5"
            >
              <div className="h-4 w-32 bg-[var(--bg-hover)] rounded mb-3" />
              <div className="h-3 w-48 bg-[var(--bg-hover)] rounded mb-2" />
              <div className="h-3 w-24 bg-[var(--bg-hover)] rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
