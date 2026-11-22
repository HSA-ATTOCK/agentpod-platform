import type { Metadata } from "next";
import { AgentsOverview } from "@/components/dashboard/agents-overview";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { RecentExecutions } from "@/components/dashboard/recent-executions";
import { StatCard } from "@/components/dashboard/stat-card";
import { Badge } from "@/components/ui/badge";
import {
  SAMPLE_NOW,
  sampleActivity,
  sampleAgents,
  sampleExecutions,
  sampleUser,
  sampleWorkflows,
  sampleWorkspace,
} from "@/lib/sample-data";

export const metadata: Metadata = { title: "Dashboard" };

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function percent(part: number, total: number) {
  return total === 0 ? "0%" : `${Math.round((part / total) * 100)}%`;
}

export default function DashboardPage() {
  // Phase 1: sample data. Phase 2: load these for the signed-in user's workspace.
  const agents = sampleAgents;
  const workflows = sampleWorkflows;
  const executions = sampleExecutions;
  const now = SAMPLE_NOW;

  // All numbers are calculated from the data, never typed in by hand
  const activeAgents = agents.filter((a) => a.status === "active").length;
  const activeWorkflows = workflows.filter((w) => w.status === "active").length;
  const weekStart = new Date(now).getTime() - WEEK_MS;
  const executionsThisWeek = executions.filter((e) => new Date(e.startedAt).getTime() >= weekStart);
  const succeeded = executionsThisWeek.filter((e) => e.status === "succeeded").length;
  const failed = executionsThisWeek.filter((e) => e.status === "failed").length;
  const finished = succeeded + failed;

  const firstName = sampleUser.fullName.split(" ")[0];

  return (
    <div className="space-y-8">
      <header>
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Welcome back, {firstName}
          </h1>
          <Badge tone="info" title="These numbers are examples. Your real data will appear here once your workspace is connected.">
            Sample data
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted">
          Workspace: <strong className="font-semibold text-foreground">{sampleWorkspace.name}</strong>
        </p>
      </header>

      <section aria-labelledby="overview-title">
        <h2 id="overview-title" className="sr-only">
          Overview
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-6">
          <StatCard label="Total agents" value={agents.length} />
          <StatCard label="Active agents" value={activeAgents} tone="accent" detail={`${percent(activeAgents, agents.length)} of agents`} />
          <StatCard label="Total workflows" value={workflows.length} detail={`${activeWorkflows} active`} />
          <StatCard label="Executions this week" value={executionsThisWeek.length} />
          <StatCard label="Successful tasks" value={succeeded} tone="success" detail={percent(succeeded, finished)} />
          <StatCard label="Failed tasks" value={failed} tone="danger" detail={percent(failed, finished)} />
        </div>
      </section>

      <QuickActions />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <AgentsOverview agents={agents} now={now} className="lg:col-span-7" />
        <RecentActivity events={sampleActivity} now={now} className="lg:col-span-5" />
      </div>

      <RecentExecutions executions={executions} now={now} />
    </div>
  );
}
