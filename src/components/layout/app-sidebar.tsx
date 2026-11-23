import { LogOut, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Logo } from "@/components/ui/logo";
import { routes } from "@/config/routes";
import type { UserProfile } from "@/types";
import { SidebarNav } from "./nav-link";
import { WorkspaceSwitcher, type PendingInvite, type SwitcherWorkspace } from "./workspace-switcher";

type AppSidebarProps = {
  workspace: SwitcherWorkspace;
  workspaces: SwitcherWorkspace[];
  invites: PendingInvite[];
  user: UserProfile;
};

/** Fixed left sidebar for large screens. Hidden on phones and tablets. */
export function AppSidebar({ workspace, workspaces, invites, user }: AppSidebarProps) {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border bg-surface lg:flex">
      <div className="flex h-16 items-center border-b border-border px-5">
        <Logo size="sm" href={routes.dashboard} />
      </div>

      <div className="p-3">
        <WorkspaceSwitcher current={workspace} workspaces={workspaces} invites={invites} />
      </div>

      <nav aria-label="Main" className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        <SidebarNav group="main" />
      </nav>

      <div className="space-y-1 border-t border-border p-3">
        <nav aria-label="Account" className="space-y-1">
          <SidebarNav group="secondary" />
          {user.isPlatformAdmin && (
            <Link
              href={routes.admin}
              className="flex items-center gap-3 rounded-control border border-transparent px-3 py-2 text-sm font-medium text-warning transition-colors hover:bg-surface-raised"
            >
              <ShieldCheck aria-hidden="true" className="size-4" />
              <span>Platform admin</span>
            </Link>
          )}
        </nav>

        <div className="mt-1 border-t border-border pt-2">
          <div className="flex items-center gap-3 rounded-control border border-border bg-surface-raised p-2">
            <Avatar name={user.fullName} src={user.avatarUrl} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-foreground">{user.fullName}</p>
              <p className="truncate text-[11px] text-subtle">{user.email}</p>
            </div>
            <form action={routes.signOut} method="post">
              <button
                type="submit"
                aria-label="Sign out"
                title="Sign out"
                className="rounded-md p-1.5 text-subtle transition-colors hover:text-danger"
              >
                <LogOut aria-hidden="true" className="size-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </aside>
  );
}
