import { ChevronsUpDown, LogOut } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Logo } from "@/components/ui/logo";
import { routes } from "@/config/routes";
import type { UserProfile, Workspace } from "@/types";
import { SidebarNav } from "./nav-link";

type AppSidebarProps = { workspace: Workspace; user: UserProfile };

/** Fixed left sidebar for large screens. Hidden on phones and tablets. */
export function AppSidebar({ workspace, user }: AppSidebarProps) {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border bg-surface lg:flex">
      <div className="flex h-16 items-center border-b border-border px-5">
        <Logo size="sm" href={routes.dashboard} />
      </div>

      {/* Workspace switcher (visual only until workspaces arrive in Phase 2) */}
      <div className="p-3">
        <button
          type="button"
          aria-label={`Current workspace: ${workspace.name}. Switch workspace`}
          className="flex w-full items-center justify-between gap-2 rounded-control border border-border bg-surface-raised p-2.5 text-left transition-colors hover:bg-surface-hover"
        >
          <span className="flex min-w-0 items-center gap-2.5">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent/20 text-xs font-bold text-accent">
              {workspace.name[0]}
            </span>
            <span className="truncate text-xs font-semibold text-foreground">{workspace.name}</span>
          </span>
          <ChevronsUpDown aria-hidden="true" className="size-4 shrink-0 text-subtle" />
        </button>
      </div>

      <nav aria-label="Main" className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        <SidebarNav group="main" />
      </nav>

      <div className="space-y-1 border-t border-border p-3">
        <nav aria-label="Account" className="space-y-1">
          <SidebarNav group="secondary" />
        </nav>

        <div className="mt-1 border-t border-border pt-2">
          <div className="flex items-center gap-3 rounded-control border border-border bg-surface-raised p-2">
            <Avatar name={user.fullName} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-foreground">{user.fullName}</p>
              <p className="truncate text-[11px] text-subtle">{user.email}</p>
            </div>
            <Link
              href={routes.signIn}
              aria-label="Sign out"
              title="Sign out"
              className="rounded-md p-1.5 text-subtle transition-colors hover:text-danger"
            >
              <LogOut aria-hidden="true" className="size-4" />
            </Link>
          </div>
        </div>
      </div>
    </aside>
  );
}
