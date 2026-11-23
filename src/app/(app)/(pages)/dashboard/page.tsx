import type { Metadata } from "next";
import { connection } from "next/server";
import { AgentsOverview } from "@/components/dashboard/agents-overview";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { RecentActivity, type ActivityItem } from "@/components/dashboard/recent-activity";
import { RecentExecutions } from "@/components/dashboard/recent-executions";
import { StatCard } from "@/components/dashboard/stat-card";
import { requireAppContext } from "@/lib/data/context";
import { daysAgo, listTasks, listWorkflows, modelInfo, monthStart } from "@/lib/data/pages";
import { formatCents } from "@/lib/format";
import type { TaskRecord } from "@/types/app-data";

export const metadata: Metadata = { title: "Dashboard" };

function percent(part: number, total: number) {
  return total === 0 ? "—" : `${Math.round((part / total) * 100)}%`;
}

function shorten(text: string, max = 80) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Turns tasks and their files into a short timeline. */
function activityFrom(tasks: TaskRecord[]): ActivityItem[] {
  const items: ActivityItem[] = [];
  for (const task of tasks.slice(0, 15)) {
    for (const file of task.files) {
      items.push({ id: `file-${file.id}`, title: "File created", description: file.name, tone: "info", at: file.createdAt });
    }
    const at = task.finishedAt ?? task.startedAt;
    const description = shorten(task.request);
    if (task.status === "succeeded") items.push({ id: task.id, title: "Task finished", description, tone: "success", at });
    else if (task.status === "failed") items.push({ id: task.id, title: "Task failed", description, tone: "danger", at });
    else if (task.status === "paused") items.push({ id: task.id, title: "Paused at spending cap", description, tone: "warning", at });
    else items.push({ id: task.id, title: "Task started", description, tone: "info", at });
  }
  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 6);
}

export default async function DashboardPage() {
  await connection();
  const ctx = await requireAppContext();
  const [tasks, workflows] = await Promise.all([listTasks(ctx, { days: 31 }), listWorkflows(ctx)]);

  const weekStart = daysAgo(7);
  const thisWeek = tasks.filter((t) => t.startedAt >= weekStart);
  const succeeded = thisWeek.filter((t) => t.status === "succeeded").length;
  const failed = thisWeek.filter((t) => t.status === "failed").length;
  const finished = succeeded + failed;

  const since = monthStart();
  const thisMonth = tasks.filter((t) => t.startedAt >= since);
  const spend = thisMonth.reduce((sum, t) => sum + t.costCents, 0);
  const filesThisMonth = thisMonth.reduce((sum, t) => sum + t.files.length, 0);
  const taskCounts: Record<string, number> = {};
  for (const task of thisMonth) {
    for (const name of new Set(["Baba", ...task.agents])) taskCounts[name] = (taskCounts[name] ?? 0) + 1;
  }

  const firstName = ctx.user.fullName.split(" ")[0];
  const limit = Math.round(ctx.workspace.monthlyLimitUsd * 100);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Welcome back, {firstName}</h1>
        <p className="mt-1 text-sm text-muted">
          Workspace: <strong className="font-semibold text-foreground">{ctx.workspace.name}</strong>
        </p>
      </header>

      <section aria-labelledby="overview-title">
        <h2 id="overview-title" className="sr-only">
          Overview
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-6">
          <StatCard label="Tasks this week" value={thisWeek.length} />
          <StatCard label="Succeeded" value={succeeded} tone="success" detail={percent(succeeded, finished)} />
          <StatCard label="Failed" value={failed} tone="danger" detail={percent(failed, finished)} />
          <StatCard label="Spend this month" value={formatCents(spend)} tone="accent" detail={`of ${formatCents(limit)}`} />
          <StatCard label="Files this month" value={filesThisMonth} />
          <StatCard label="Workflows" value={workflows.length} />
        </div>
      </section>

      <QuickActions />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <AgentsOverview taskCounts={taskCounts} modelLabel={modelInfo().label} className="lg:col-span-7" />
        <RecentActivity events={activityFrom(tasks)} className="lg:col-span-5" />
      </div>

      <RecentExecutions tasks={tasks.slice(0, 5)} />
    </div>
  );
}
