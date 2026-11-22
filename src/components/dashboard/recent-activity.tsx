import { Activity } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { routes } from "@/config/routes";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ActivityEvent, ActivityEventTone } from "@/types";
import { DashboardPanel } from "./dashboard-panel";

const dotColor: Record<ActivityEventTone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
  neutral: "bg-subtle",
};

type RecentActivityProps = { events: ActivityEvent[]; now: string; className?: string };

export function RecentActivity({ events, now, className }: RecentActivityProps) {
  return (
    <DashboardPanel
      title="Recent activity"
      subtitle="What happened in your workspace"
      viewAllHref={events.length > 0 ? routes.activity : undefined}
      className={className}
    >
      {events.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No activity yet"
          description="Events like completed tasks and approval requests will show up here."
        />
      ) : (
        <ol className="relative mt-4 space-y-6 border-l border-border pl-4 text-xs">
          {events.map((event) => (
            <li key={event.id} className="relative">
              <span
                aria-hidden="true"
                className={cn(
                  "absolute -left-[21px] top-1 size-2.5 rounded-full ring-4 ring-surface",
                  dotColor[event.tone],
                )}
              />
              <p className="font-medium text-foreground">{event.title}</p>
              <p className="mt-0.5 text-subtle">{event.description}</p>
              <time dateTime={event.occurredAt} className="mt-1 block text-[11px] text-subtle">
                {formatRelativeTime(event.occurredAt, now)}
              </time>
            </li>
          ))}
        </ol>
      )}
    </DashboardPanel>
  );
}
