import { History, Plus } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { routes } from "@/config/routes";
import { formatDateTime, formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Execution, ExecutionStatus } from "@/types";
import { DashboardPanel } from "./dashboard-panel";

const durationColor: Record<ExecutionStatus, string> = {
  succeeded: "text-foreground",
  failed: "text-danger",
  running: "text-info",
  queued: "text-subtle",
};

/** Running tasks show "In progress", queued ones "Waiting". */
function durationLabel(execution: Execution) {
  if (execution.status === "running") return "In progress";
  if (execution.status === "queued") return "Waiting";
  return formatDuration(execution.durationMs);
}

type RecentExecutionsProps = { executions: Execution[]; now: string };

/** Table on large screens, stacked cards on phones. */
export function RecentExecutions({ executions, now }: RecentExecutionsProps) {
  return (
    <DashboardPanel
      title="Recent executions"
      subtitle="The latest tasks your agents ran"
      viewAllHref={executions.length > 0 ? routes.activity : undefined}
    >
      {executions.length === 0 ? (
        <EmptyState
          icon={History}
          title="No executions yet"
          description="Task runs will appear here once your agents start working."
          action={
            <ButtonLink href={routes.agents} variant="secondary" size="sm">
              <Plus aria-hidden="true" className="size-3.5 text-accent" />
              Set up an agent
            </ButtonLink>
          }
        />
      ) : (
        <>
          {/* Table: tablets and up */}
          <div className="mt-2 hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wider text-subtle">
                  <th scope="col" className="px-4 py-3 font-semibold">Task</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Agent</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Started</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 text-muted">
                {executions.map((execution) => (
                  <tr key={execution.id} className="transition-colors hover:bg-surface-raised/50">
                    <td className="px-4 py-3.5 font-medium text-foreground">{execution.taskName}</td>
                    <td className="px-4 py-3.5">{execution.agentName}</td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={execution.status} className="text-[11px]" />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-subtle">
                      <time dateTime={execution.startedAt}>{formatDateTime(execution.startedAt, now)}</time>
                    </td>
                    <td className={cn("whitespace-nowrap px-4 py-3.5 text-right tabular-nums", durationColor[execution.status])}>
                      {durationLabel(execution)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cards: phones */}
          <ul className="mt-3 space-y-3 md:hidden">
            {executions.map((execution) => (
              <li key={execution.id} className="space-y-2 rounded-xl border border-border bg-surface-raised p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-semibold text-foreground">{execution.taskName}</span>
                  <StatusBadge status={execution.status} className="text-[11px]" />
                </div>
                <div className="flex items-center justify-between gap-2 text-xs text-subtle">
                  <span className="truncate">{execution.agentName}</span>
                  <span className={cn("shrink-0 tabular-nums", durationColor[execution.status])}>
                    {durationLabel(execution)}
                  </span>
                </div>
                <time dateTime={execution.startedAt} className="block text-[11px] text-subtle">
                  {formatDateTime(execution.startedAt, now)}
                </time>
              </li>
            ))}
          </ul>
        </>
      )}
    </DashboardPanel>
  );
}
