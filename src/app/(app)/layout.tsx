import { Suspense, type ReactNode } from "react";
import { AppMobileHeader } from "@/components/layout/app-mobile-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTabBar } from "@/components/layout/app-tab-bar";
import { AppTopbar } from "@/components/layout/app-topbar";
import { Spinner } from "@/components/ui/spinner";
import { requireAppContext } from "@/lib/data/context";
import { listMyInvites } from "@/lib/data/pages";
import { getPlatformSettings } from "@/lib/platform/account";

/** Shared frame for every logged-in page. Only signed-in people get past requireAppContext. */
async function AppFrame({ children }: { children: ReactNode }) {
  const ctx = await requireAppContext();
  const { workspace, workspaces } = ctx;
  const user = { ...ctx.user, isPlatformAdmin: ctx.isPlatformAdmin };
  const settings = await getPlatformSettings(ctx.supabase);
  // Invites to other workspaces (not the one they're in)
  const invites = (await listMyInvites(ctx)).filter((i) => !workspaces.some((w) => w.name === i.workspaceName));
  const current = { id: workspace.id, name: workspace.name, role: workspace.role, logoUrl: workspace.logoUrl };
  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <AppSidebar workspace={current} workspaces={workspaces} invites={invites} user={user} />
      <AppMobileHeader workspace={current} workspaces={workspaces} invites={invites} user={user} />

      <div className="flex flex-1 flex-col lg:pl-64">
        <AppTopbar workspaceId={workspace.id} />
        {settings?.announcement && (
          <div role="status" className="border-b border-info/30 bg-info/10 px-4 py-2 text-center text-sm text-foreground">
            {settings.announcement}
          </div>
        )}
        {settings?.maintenanceMode && ctx.isPlatformAdmin && (
          <div role="status" className="border-b border-warning/30 bg-warning/10 px-4 py-2 text-center text-sm text-warning">
            Maintenance mode is on: only platform administrators can use Baba right now.
          </div>
        )}
        {/* Each page group renders its own <main> (padded pages vs. full-height chat) */}
        {children}
      </div>

      <AppTabBar />
    </div>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-1 items-center justify-center" aria-busy="true">
          <Spinner />
        </div>
      }
    >
      <AppFrame>{children}</AppFrame>
    </Suspense>
  );
}
