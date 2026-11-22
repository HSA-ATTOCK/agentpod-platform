import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
  /** Usually a ButtonLink. */
  action?: ReactNode;
  className?: string;
};

/** Shown in place of a list when it has no items yet. */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-4 py-10 text-center", className)}>
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl border border-border bg-surface-raised text-subtle">
        <Icon aria-hidden="true" className="size-7" />
      </div>
      <h3 className="mb-1.5 text-base font-semibold text-foreground">{title}</h3>
      {description && <p className="mb-6 max-w-xs text-xs text-muted">{description}</p>}
      {action}
    </div>
  );
}
