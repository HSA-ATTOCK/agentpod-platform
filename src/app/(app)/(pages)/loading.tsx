/** Skeleton shown while an app page loads its data. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="animate-pulse space-y-6">
      <div className="h-8 w-48 rounded-lg bg-surface-raised" />
      <div className="h-4 w-80 max-w-full rounded bg-surface-raised" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-24 rounded-card border border-border bg-surface" />
        ))}
      </div>
      <div className="h-72 rounded-card border border-border bg-surface" />
    </div>
  );
}
