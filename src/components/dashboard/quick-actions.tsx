import { FolderOpen, History, MessageSquare, Repeat } from "lucide-react";
import Link from "next/link";
import { routes } from "@/config/routes";
import { cn } from "@/lib/utils";

const actions = [
  { label: "Ask Baba", detail: "Give Baba a new task", href: routes.ask, icon: MessageSquare, iconClass: "bg-accent/15 text-accent" },
  { label: "Create workflow", detail: "Save a task you repeat", href: routes.workflows, icon: Repeat, iconClass: "bg-info/15 text-info" },
  { label: "Your files", detail: "Reports and spreadsheets", href: routes.projects, icon: FolderOpen, iconClass: "bg-warning/15 text-warning" },
  { label: "View activity", detail: "Every task and its cost", href: routes.activity, icon: History, iconClass: "bg-foreground/10 text-foreground" },
];

export function QuickActions() {
  return (
    <section aria-labelledby="quick-actions-title">
      <h2 id="quick-actions-title" className="sr-only">
        Quick actions
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {actions.map((action) => (
          <Link
            key={action.label}
            href={action.href}
            className="group flex items-center gap-3 rounded-xl border border-border bg-surface p-3.5 transition-colors hover:border-border-strong hover:bg-surface-raised"
          >
            <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-105", action.iconClass)}>
              <action.icon aria-hidden="true" className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-semibold text-foreground sm:truncate">{action.label}</span>
              <span className="hidden truncate text-[11px] text-subtle sm:block">{action.detail}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
