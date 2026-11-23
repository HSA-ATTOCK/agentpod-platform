"use client";

import {
  Activity,
  Bot,
  Building2,
  CreditCard,
  Gauge,
  HeartPulse,
  LayoutDashboard,
  ScrollText,
  Settings,
  UserCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { routes } from "@/config/routes";
import { cn } from "@/lib/utils";

const ITEMS = [
  { label: "Overview", href: routes.admin, icon: LayoutDashboard },
  { label: "Registrations", href: `${routes.admin}/registrations`, icon: UserCheck },
  { label: "Users", href: `${routes.admin}/users`, icon: Users },
  { label: "Workspaces", href: `${routes.admin}/workspaces`, icon: Building2 },
  { label: "Agents", href: `${routes.admin}/agents`, icon: Bot },
  { label: "Plans", href: `${routes.admin}/plans`, icon: CreditCard },
  { label: "Usage & costs", href: `${routes.admin}/usage`, icon: Gauge },
  { label: "Audit log", href: `${routes.admin}/audit`, icon: ScrollText },
  { label: "System health", href: `${routes.admin}/health`, icon: HeartPulse },
  { label: "Settings", href: `${routes.admin}/settings`, icon: Settings },
];

/** The platform-admin navigation (separate from the workspace app). */
export function AdminNav({ pendingCount }: { pendingCount: number }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Administration" className="flex gap-1 overflow-x-auto lg:flex-col">
      {ITEMS.map((item) => {
        const active = item.href === routes.admin ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2.5 rounded-control border px-3 py-2 text-sm font-medium transition-colors",
              active ? "border-accent/20 bg-accent/10 text-accent" : "border-transparent text-muted hover:bg-surface-raised hover:text-foreground",
            )}
          >
            <item.icon aria-hidden="true" className="size-4" />
            {item.label}
            {item.label === "Registrations" && pendingCount > 0 && (
              <span className="ml-auto rounded-full bg-accent px-1.5 text-[11px] font-semibold text-background">{pendingCount}</span>
            )}
          </Link>
        );
      })}
      <Link href={routes.ask} className="mt-2 hidden items-center gap-2.5 rounded-control px-3 py-2 text-sm text-subtle hover:text-foreground lg:flex">
        <Activity aria-hidden="true" className="size-4" />
        Back to the app
      </Link>
    </nav>
  );
}
