import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { AdminNav } from "@/components/admin/admin-nav";
import { ButtonLink } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { Spinner } from "@/components/ui/spinner";
import { routes } from "@/config/routes";
import { requirePlatformAdmin } from "@/lib/platform/admin";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Baba admin" }, robots: { index: false } };

/** Platform administration: a separate, protected area (404 for everyone who isn't a platform admin). */
async function AdminFrame({ children }: { children: ReactNode }) {
  const ctx = await requirePlatformAdmin();
  const { count } = await ctx.db.from("platform_accounts").select("user_id", { count: "exact", head: true }).eq("status", "pending_approval");
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur sm:px-6">
        <div className="flex items-center gap-3">
          <Logo size="sm" href={routes.admin} />
          <span className="rounded-full border border-warning/30 bg-warning/15 px-2 py-0.5 text-[11px] font-semibold text-warning">Platform admin</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted">
          <span className="hidden sm:inline">{ctx.user.email}</span>
          <ButtonLink href={routes.ask} size="sm" variant="secondary">
            Open app
          </ButtonLink>
        </div>
      </header>
      <div className="mx-auto flex max-w-7xl flex-col gap-6 p-4 sm:p-6 lg:flex-row lg:p-8">
        <aside className="lg:w-56 lg:shrink-0">
          <AdminNav pendingCount={count ?? 0} />
        </aside>
        <main className="min-w-0 flex-1 space-y-6">{children}</main>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center" aria-busy="true">
          <Spinner />
        </div>
      }
    >
      <AdminFrame>{children}</AdminFrame>
    </Suspense>
  );
}
