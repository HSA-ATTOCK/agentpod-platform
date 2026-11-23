/** Grey placeholder blocks shown while an app page loads. */
export function PageSkeleton() {
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

/** Placeholder for the Ask Baba screen (fills the same space as the chat). */
export function AskSkeleton() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading"
      className="flex h-[calc(100dvh-7rem-1px-env(safe-area-inset-bottom))] min-h-0 animate-pulse lg:h-[calc(100dvh-4rem)]"
    >
      <div className="hidden w-72 shrink-0 space-y-3 border-r border-border bg-surface p-4 lg:block">
        <div className="h-10 rounded-control bg-surface-raised" />
        <div className="h-10 rounded-control bg-surface-raised" />
        <div className="h-14 rounded-control bg-surface-raised" />
        <div className="h-14 rounded-control bg-surface-raised" />
      </div>
      <div className="flex flex-1 items-end justify-center p-6">
        <div className="h-24 w-full max-w-3xl rounded-card bg-surface-raised" />
      </div>
    </main>
  );
}
