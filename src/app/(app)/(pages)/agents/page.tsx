import type { Metadata } from "next";
import { AgentsView, type AgentUsage } from "@/components/pages/agents-view";
import { CustomAgents, type CustomAgentRow } from "@/components/pages/custom-agents";
import { canManage, requireAppContext } from "@/lib/data/context";
import { getWorkspaceSettings, listTasks, modelInfo, monthStart } from "@/lib/data/pages";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/page-skeleton";

export const metadata: Metadata = { title: "AI Agents" };

async function PageContent() {
  const ctx = await requireAppContext();
  const [tasks, settings, { data: custom }] = await Promise.all([
    listTasks(ctx, { days: 31 }),
    getWorkspaceSettings(ctx),
    ctx.supabase
      .from("custom_agents")
      .select("id, name, description, instructions, model, web_access, max_cost_usd, enabled, runs, last_run_at, tools")
      .eq("workspace_id", ctx.workspace.id)
      .order("name"),
  ]);
  const customAgents: CustomAgentRow[] = (custom ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    description: a.description,
    instructions: a.instructions,
    model: a.model,
    webAccess: a.web_access,
    maxCostUsd: Number(a.max_cost_usd),
    enabled: a.enabled,
    runs: a.runs,
    lastRunAt: a.last_run_at,
    tools: a.tools,
  }));

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
    <div className="space-y-10">
    <AgentsView
      model={modelInfo()}
      usage={usage}
      workspaceId={ctx.workspace.id}
      businessContext={settings.businessContext}
      canEdit={canManage(ctx.workspace.role)}
    />
    <CustomAgents agents={customAgents} canEdit={canManage(ctx.workspace.role)} />
    </div>
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
