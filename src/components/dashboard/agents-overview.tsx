import { Badge } from "@/components/ui/badge";
import { routes } from "@/config/routes";
import { mainAgent, specialists } from "@/config/team";
import { cn } from "@/lib/utils";
import { DashboardPanel } from "./dashboard-panel";

type AgentsOverviewProps = {
  /** Tasks this month per agent name. */
  taskCounts: Record<string, number>;
  modelLabel: string;
  className?: string;
};

/** Baba and the specialists that can work today, with this month's task counts. */
export function AgentsOverview({ taskCounts, modelLabel, className }: AgentsOverviewProps) {
  const team = [
    { name: mainAgent.name, job: "Main agent: plans the work and checks results", icon: mainAgent.icon },
    ...specialists.filter((s) => s.status === "active").map((s) => ({ name: s.name, job: s.job, icon: s.icon })),
  ];
  const comingSoon = specialists.filter((s) => s.status === "coming_soon").length;

  return (
    <DashboardPanel title="AI agents" subtitle={`Running on ${modelLabel}`} viewAllHref={routes.agents} className={className}>
      <ul className="divide-y divide-border/60">
        {team.map((agent, i) => (
          <li key={agent.name} className="flex items-center justify-between gap-3 py-3.5">
            <div className="flex min-w-0 items-center gap-3">
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-raised text-accent",
                  i === 0 && "border-accent/30 bg-accent/10",
                )}
              >
                <agent.icon aria-hidden="true" className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{agent.name}</p>
                <p className="truncate text-xs text-subtle">{agent.job}</p>
              </div>
            </div>
            <span className="shrink-0 text-right text-xs text-muted">
              <span className="block text-sm font-semibold text-foreground">{taskCounts[agent.name] ?? 0}</span>
              this month
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 flex items-center gap-2 text-xs text-subtle">
        <Badge tone="neutral">{comingSoon} more</Badge> specialists coming soon, like Website Builder and Designer.
      </p>
    </DashboardPanel>
  );
}
