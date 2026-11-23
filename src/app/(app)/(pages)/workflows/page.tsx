import type { Metadata } from "next";
import { WorkflowsView } from "@/components/pages/workflows-view";
import { canManage, requireAppContext } from "@/lib/data/context";
import { listWorkflows } from "@/lib/data/pages";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/page-skeleton";

export const metadata: Metadata = { title: "Workflows" };

async function PageContent() {
  const ctx = await requireAppContext();
  const workflows = await listWorkflows(ctx);
  return (
    <WorkflowsView
      workflows={workflows}
      workspaceId={ctx.workspace.id}
      userId={ctx.user.id}
      canWrite={ctx.workspace.role !== "viewer"}
      canManageAll={canManage(ctx.workspace.role)}
    />
  );
}

/** Shows a placeholder straight away while this page's data loads. */
export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PageContent />
    </Suspense>
  );
}
