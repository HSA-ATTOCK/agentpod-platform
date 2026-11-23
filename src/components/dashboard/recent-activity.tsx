import { Activity } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { LocalTime } from "@/components/ui/local-time";
import { routes } from "@/config/routes";
import { cn } from "@/lib/utils";
import { DashboardPanel } from "./dashboard-panel";

export type ActivityItem = {
  id: string;
  title: string;
  description: string;
  tone: "success" | "warning" | "danger" | "info";
  at: string;
};

const dotColor: Record<ActivityItem["tone"], string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
};


export function RecentActivity({ events, className }: { events: ActivityItem[]; className?: string }) {
  return (
    <DashboardPanel
      title="Recent activity"
      subtitle="What happened in your workspace"
      viewAllHref={events.length > 0 ? routes.activity : undefined}
      className={className}
    >
      {events.length === 0 ? (
        <EmptyState icon={Activity} title="No activity yet" description="Finished tasks, files and paused work will show up here." />
      ) : (
        <ol className="relative mt-4 space-y-6 border-l border-border pl-4 text-xs">
          {events.map((event) => (
            <li key={event.id} className="relative">
              <span aria-hidden="true" className={cn("absolute -left-[21px] top-1 size-2.5 rounded-full ring-4 ring-surface", dotColor[event.tone])} />
              <p className="font-medium text-foreground">{event.title}</p>
              <p className="mt-0.5 line-clamp-2 text-subtle">{event.description}</p>
              <LocalTime iso={event.at} format="relative" className="mt-1 block text-[11px] text-subtle" />
            </li>
          ))}
        </ol>
      )}
    </DashboardPanel>
  );
}
