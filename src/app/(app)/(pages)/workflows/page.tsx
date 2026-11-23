import type { Metadata } from "next";
import { WorkflowsView } from "@/components/pages/workflows-view";
import { canManage, requireAppContext } from "@/lib/data/context";
import { listWorkflows } from "@/lib/data/pages";

export const metadata: Metadata = { title: "Workflows" };

export default async function Page() {
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
