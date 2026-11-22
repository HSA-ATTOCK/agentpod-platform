import { BotOff, Plus } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { routes } from "@/config/routes";
import { agentCategoryMeta } from "@/lib/agent-meta";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Agent, AgentStatus } from "@/types";
import { DashboardPanel } from "./dashboard-panel";

const iconColorByStatus: Record<AgentStatus, string> = {
  active: "text-accent",
  paused: "text-warning",
  draft: "text-muted",
  error: "text-danger",
};

type AgentsOverviewProps = { agents: Agent[]; now: string; className?: string };

export function AgentsOverview({ agents, now, className }: AgentsOverviewProps) {
  return (
    <DashboardPanel
      title="AI agents"
      subtitle={agents.length > 0 ? `${agents.length} agents in this workspace` : undefined}
      viewAllHref={agents.length > 0 ? routes.agents : undefined}
      className={className}
    >
      {agents.length === 0 ? (
        <EmptyState
          icon={BotOff}
          title="No agents yet"
          description="You haven't created any AI agents yet."
          action={
            <ButtonLink href={routes.agents} size="sm">
              <Plus aria-hidden="true" className="size-3.5" />
              Create your first agent
            </ButtonLink>
          }
        />
      ) : (
        <ul className="divide-y divide-border/60">
          {agents.map((agent) => {
            const category = agentCategoryMeta[agent.category];
            return (
              <li key={agent.id} className="flex items-center justify-between gap-3 py-3.5">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-raised",
                      iconColorByStatus[agent.status],
                    )}
                  >
                    <category.icon aria-hidden="true" className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{agent.name}</p>
                    <p className="truncate text-xs text-subtle">
                      {category.label} ·{" "}
                      {agent.lastActiveAt
                        ? `Last active ${formatRelativeTime(agent.lastActiveAt, now)}`
                        : "Never run"}
                    </p>
                  </div>
                </div>
                <StatusBadge status={agent.status} />
              </li>
            );
          })}
        </ul>
      )}
    </DashboardPanel>
  );
}
