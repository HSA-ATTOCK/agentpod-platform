import { Suspense, type ReactNode } from "react";
import { AppMobileHeader } from "@/components/layout/app-mobile-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTabBar } from "@/components/layout/app-tab-bar";
import { AppTopbar } from "@/components/layout/app-topbar";
import { Spinner } from "@/components/ui/spinner";
import { requireAppContext } from "@/lib/data/context";
import { listMyInvites } from "@/lib/data/pages";

/** Shared frame for every logged-in page. Only signed-in people get past requireAppContext. */
async function AppFrame({ children }: { children: ReactNode }) {
  const ctx = await requireAppContext();
  const { user, workspace, workspaces } = ctx;
  // Invites to other workspaces (not the one they're in)
  const invites = (await listMyInvites(ctx)).filter((i) => !workspaces.some((w) => w.name === i.workspaceName));
  const current = { id: workspace.id, name: workspace.name, role: workspace.role };
  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <AppSidebar workspace={current} workspaces={workspaces} invites={invites} user={user} />
      <AppMobileHeader workspace={current} workspaces={workspaces} invites={invites} user={user} />

      <div className="flex flex-1 flex-col lg:pl-64">
        <AppTopbar workspaceId={workspace.id} />
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
