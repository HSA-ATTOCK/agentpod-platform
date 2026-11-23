import { Suspense, type ReactNode } from "react";
import { AppMobileHeader } from "@/components/layout/app-mobile-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTabBar } from "@/components/layout/app-tab-bar";
import { AppTopbar } from "@/components/layout/app-topbar";
import { Spinner } from "@/components/ui/spinner";
import { requireAppContext } from "@/lib/data/context";

/** Shared frame for every logged-in page. Only signed-in people get past requireAppContext. */
async function AppFrame({ children }: { children: ReactNode }) {
  const { user, workspace } = await requireAppContext();
  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <AppSidebar workspace={workspace} user={user} />
      <AppMobileHeader workspace={workspace} user={user} />

      <div className="flex flex-1 flex-col lg:pl-64">
        <AppTopbar />
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
