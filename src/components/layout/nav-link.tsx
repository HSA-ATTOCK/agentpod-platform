"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { appNavigation, appSecondaryNavigation, type NavItem } from "@/config/navigation";
import { cn } from "@/lib/utils";

/** True when the current URL is this item's page or a page inside it. */
function useIsActive(href: string) {
  const pathname = usePathname();
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** A row in the desktop sidebar. */
function SidebarNavLink({ item }: { item: NavItem }) {
  const active = useIsActive(item.href);
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-control border px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "border-accent/20 bg-accent/10 text-accent"
          : "border-transparent text-muted hover:bg-surface-raised hover:text-foreground",
      )}
    >
      <item.icon aria-hidden="true" className={cn("size-4", active ? "text-accent" : "text-subtle")} />
      <span>{item.label}</span>
    </Link>
  );
}

/** A tab in the mobile bottom tab bar. */
function TabBarLink({ item }: { item: NavItem }) {
  const active = useIsActive(item.href);
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-14 flex-1 flex-col items-center justify-center gap-1 rounded-lg transition-colors",
        active ? "text-accent" : "text-subtle hover:text-foreground",
      )}
    >
      <item.icon aria-hidden="true" className="size-5" />
      <span className={cn("text-[11px]", active ? "font-semibold" : "font-medium")}>
        {item.shortLabel ?? item.label}
      </span>
    </Link>
  );
}

// The menu config contains icon components, which can't be passed from a
// server component as props. So these client components read it directly.

/** List of sidebar links. "main" = primary pages, "secondary" = Settings/Profile. */
export function SidebarNav({ group }: { group: "main" | "secondary" }) {
  const items = group === "main" ? appNavigation : appSecondaryNavigation;
  return items.map((item) => <SidebarNavLink key={item.href} item={item} />);
}

/** The tabs of the mobile tab bar (items marked inTabBar). */
export function TabBarNav() {
  return appNavigation
    .filter((item) => item.inTabBar)
    .map((item) => <TabBarLink key={item.href} item={item} />);
}
