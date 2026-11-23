import { History, MessageSquare } from "lucide-react";
import Link from "next/link";
import { RunStatusBadge } from "@/components/pages/run-status-badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LocalTime } from "@/components/ui/local-time";
import { routes } from "@/config/routes";
import { durationBetween, formatCents } from "@/lib/format";
import type { TaskRecord } from "@/types/app-data";
import { DashboardPanel } from "./dashboard-panel";

function taskLink(task: TaskRecord) {
  return task.conversationId ? `${routes.ask}?c=${task.conversationId}` : routes.activity;
}

/** The latest tasks: table on large screens, stacked cards on phones. */
export function RecentExecutions({ tasks }: { tasks: TaskRecord[] }) {
  return (
    <DashboardPanel title="Recent tasks" subtitle="The latest work Baba did" viewAllHref={tasks.length > 0 ? routes.activity : undefined}>
      {tasks.length === 0 ? (
        <EmptyState
          icon={History}
          title="No tasks yet"
          description="Give Baba its first task: research, a report, a spreadsheet analysis…"
          action={
            <ButtonLink href={routes.ask} size="sm">
              <MessageSquare aria-hidden="true" className="size-3.5" />
              Ask Baba
            </ButtonLink>
          }
        />
      ) : (
        <>
          <div className="mt-2 hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wider text-subtle">
                  <th scope="col" className="px-4 py-3 font-semibold">Task</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Started</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Duration</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 text-muted">
                {tasks.map((task) => (
                  <tr key={task.id} className="transition-colors hover:bg-surface-raised/50">
                    <td className="max-w-md px-4 py-3.5">
                      <Link href={taskLink(task)} className="block truncate font-medium text-foreground hover:text-accent">
                        {task.request}
                      </Link>
                    </td>
                    <td className="px-4 py-3.5"><RunStatusBadge status={task.status} /></td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-subtle"><LocalTime iso={task.startedAt} /></td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-right tabular-nums">{durationBetween(task.startedAt, task.finishedAt)}</td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-right tabular-nums text-foreground">{formatCents(task.costCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="mt-3 space-y-3 md:hidden">
            {tasks.map((task) => (
              <li key={task.id}>
                <Link href={taskLink(task)} className="block space-y-2 rounded-xl border border-border bg-surface-raised p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="line-clamp-2 text-sm font-semibold text-foreground">{task.request}</span>
                    <RunStatusBadge status={task.status} />
                  </div>
                  <div className="flex items-center justify-between gap-2 text-xs text-subtle">
                    <LocalTime iso={task.startedAt} />
                    <span className="tabular-nums text-foreground">{formatCents(task.costCents)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </DashboardPanel>
  );
}
