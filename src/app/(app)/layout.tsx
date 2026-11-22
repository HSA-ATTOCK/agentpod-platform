import type { ReactNode } from "react";
import { AppMobileHeader } from "@/components/layout/app-mobile-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTabBar } from "@/components/layout/app-tab-bar";
import { AppTopbar } from "@/components/layout/app-topbar";
import { sampleUser, sampleWorkspace } from "@/lib/sample-data";

/**
 * Shared frame for every logged-in page.
 * NOTE: routes are not protected yet — that comes once the auth provider is chosen.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <AppSidebar workspace={sampleWorkspace} user={sampleUser} />
      <AppMobileHeader workspace={sampleWorkspace} user={sampleUser} />

      <div className="flex flex-1 flex-col lg:pl-64">
        <AppTopbar />
        {/* Each page group renders its own <main> (padded pages vs. full-height chat) */}
        {children}
      </div>

      <AppTabBar />
    </div>
  );
}
