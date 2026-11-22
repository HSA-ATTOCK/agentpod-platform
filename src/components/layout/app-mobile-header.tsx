"use client";

import { Bell, LogOut } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Logo } from "@/components/ui/logo";
import { appSecondaryNavigation } from "@/config/navigation";
import { routes } from "@/config/routes";
import type { UserProfile, Workspace } from "@/types";

type AppMobileHeaderProps = { workspace: Workspace; user: UserProfile };

/** Slim top bar for phones and tablets, with a user menu behind the avatar. */
export function AppMobileHeader({ workspace, user }: AppMobileHeaderProps) {
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
        <button
          type="button"
          aria-label="Notifications"
          className="flex size-11 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-raised hover:text-foreground"
        >
          <Bell aria-hidden="true" className="size-5" />
        </button>

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
                <p className="font-semibold text-foreground">{workspace.name}</p>
                <p className="truncate text-xs text-subtle">{user.email}</p>
              </div>
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
              <Link
                href={routes.signIn}
                className="flex items-center gap-2.5 rounded-md px-3 py-2.5 text-danger hover:bg-border"
              >
                <LogOut aria-hidden="true" className="size-4" />
                Sign out
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
