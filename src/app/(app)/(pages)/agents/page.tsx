import type { Metadata } from "next";
import { AgentsView, type AgentUsage } from "@/components/pages/agents-view";
import { canManage, requireAppContext } from "@/lib/data/context";
import { getWorkspaceSettings, listTasks, modelInfo, monthStart } from "@/lib/data/pages";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/page-skeleton";

export const metadata: Metadata = { title: "AI Agents" };

async function PageContent() {
  const ctx = await requireAppContext();
  const [tasks, settings] = await Promise.all([listTasks(ctx, { days: 31 }), getWorkspaceSettings(ctx)]);

  // Tasks this month per agent (Baba takes part in every task)
  const since = monthStart();
  const usage: AgentUsage = {};
  for (const task of tasks.filter((t) => t.startedAt >= since)) {
    for (const name of new Set(["Baba", ...task.agents])) {
      const entry = (usage[name] ??= { tasks: 0, costCents: 0 });
      entry.tasks += 1;
      entry.costCents += task.costCents;
    }
  }

  return (
    <AgentsView
      model={modelInfo()}
      usage={usage}
      workspaceId={ctx.workspace.id}
      businessContext={settings.businessContext}
      canEdit={canManage(ctx.workspace.role)}
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
