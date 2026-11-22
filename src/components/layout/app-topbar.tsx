import { Bell, Plus, Search } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { routes } from "@/config/routes";

/** Top bar above the content on large screens. */
export function AppTopbar() {
  return (
    <header className="sticky top-0 z-30 hidden h-16 items-center justify-between gap-6 border-b border-border bg-background/80 px-8 backdrop-blur-md lg:flex">
      {/* Search is visual only for now */}
      <div role="search" className="relative w-full max-w-96">
        <label htmlFor="app-search" className="sr-only">
          Search
        </label>
        <Search aria-hidden="true" className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle" />
        <input
          id="app-search"
          type="search"
          placeholder="Search agents, workflows, activity…"
          className="h-10 w-full rounded-control border border-border bg-surface pl-9 pr-14 text-sm text-foreground placeholder:text-subtle transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-border bg-surface-raised px-1.5 py-0.5 font-mono text-[10px] text-subtle">
          ⌘K
        </kbd>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          aria-label="Notifications"
          className="flex size-10 items-center justify-center rounded-control border border-border bg-surface text-muted transition-colors hover:bg-surface-raised hover:text-foreground"
        >
          <Bell aria-hidden="true" className="size-4" />
        </button>
        <ButtonLink href={routes.agents}>
          <Plus aria-hidden="true" className="size-4" />
          Create agent
        </ButtonLink>
      </div>
    </header>
  );
}
