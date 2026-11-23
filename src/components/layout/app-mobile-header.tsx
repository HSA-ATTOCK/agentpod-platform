"use client";

import { Check, LogOut } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Logo } from "@/components/ui/logo";
import { appSecondaryNavigation } from "@/config/navigation";
import { routes } from "@/config/routes";
import { switchWorkspace } from "@/lib/data/workspace-cookie";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import type { UserProfile } from "@/types";
import { NotificationsMenu } from "./notifications-menu";
import type { PendingInvite, SwitcherWorkspace } from "./workspace-switcher";

type AppMobileHeaderProps = {
  workspace: SwitcherWorkspace;
  workspaces: SwitcherWorkspace[];
  invites: PendingInvite[];
  user: UserProfile;
};

/** Slim top bar for phones and tablets, with a user menu behind the avatar. */
export function AppMobileHeader({ workspace, workspaces, invites, user }: AppMobileHeaderProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close the menu on outside click or Escape
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-surface px-4 lg:hidden">
      <Logo size="sm" href={routes.dashboard} />

      <div className="flex items-center gap-1">
        <NotificationsMenu workspaceId={workspace.id} />

        <div ref={containerRef} className="relative">
          <button
            ref={buttonRef}
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label="Open account menu"
            aria-expanded={open}
            aria-controls="mobile-user-menu"
            className="flex size-11 items-center justify-center rounded-full"
          >
            <Avatar name={user.fullName} />
          </button>

          {open && (
            <div
              id="mobile-user-menu"
              className="absolute right-0 z-50 mt-1 w-60 rounded-xl border border-border bg-surface-raised p-2 text-sm shadow-xl"
            >
              <div className="mb-1 border-b border-border px-3 py-2">
                <p className="font-semibold text-foreground">{user.fullName}</p>
                <p className="truncate text-xs text-subtle">{user.email}</p>
              </div>
              <ul aria-label="Workspaces" className="mb-1 border-b border-border pb-1">
                {workspaces.map((ws) => (
                  <li key={ws.id}>
                    <button
                      type="button"
                      onClick={() => (ws.id === workspace.id ? setOpen(false) : switchWorkspace(ws.id))}
                      className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2.5 text-left text-muted hover:bg-border hover:text-foreground"
                    >
                      <span className="truncate">{ws.name}</span>
                      {ws.id === workspace.id && <Check aria-hidden="true" className="size-4 shrink-0 text-accent" />}
                    </button>
                  </li>
                ))}
                {invites.map((invite) => (
                  <li key={invite.id} className="flex items-center justify-between gap-2 px-3 py-2">
                    <span className="truncate text-xs text-muted">Invite: {invite.workspaceName}</span>
                    <button
                      type="button"
                      onClick={async () => {
                        const { data } = await getSupabaseBrowser().rpc("accept_invite", { invite_id: invite.id });
                        if (data) switchWorkspace(data);
                      }}
                      className="shrink-0 rounded-md bg-accent px-2 py-1 text-[11px] font-semibold text-accent-foreground"
                    >
                      Join
                    </button>
                  </li>
                ))}
              </ul>
              <nav aria-label="Account">
                {appSecondaryNavigation.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2.5 rounded-md px-3 py-2.5 text-muted hover:bg-border hover:text-foreground"
                  >
                    <item.icon aria-hidden="true" className="size-4" />
                    {item.label}
                  </Link>
                ))}
              </nav>
              <div className="my-1 border-t border-border" />
              <form action={routes.signOut} method="post">
                <button
                  type="submit"
                  className="flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-left text-danger hover:bg-border"
                >
                  <LogOut aria-hidden="true" className="size-4" />
                  Sign out
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
