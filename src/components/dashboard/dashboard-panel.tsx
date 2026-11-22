import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type DashboardPanelProps = {
  title: string;
  subtitle?: string;
  /** "View all" link target. */
  viewAllHref?: string;
  /** Extra content on the right of the header. */
  headerExtra?: ReactNode;
  children: ReactNode;
  className?: string;
};

/** Card with a title row, used for each dashboard section. */
export function DashboardPanel({
  title,
  subtitle,
  viewAllHref,
  headerExtra,
  children,
  className,
}: DashboardPanelProps) {
  return (
    <Card className={cn("p-5 sm:p-6", className)}>
      <div className="flex items-start justify-between gap-3 border-b border-border pb-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {headerExtra}
          {viewAllHref && (
            <Link
              href={viewAllHref}
              className="flex items-center gap-1 py-1 text-xs font-semibold text-accent hover:underline"
            >
              View all
              <span className="sr-only"> {title.toLowerCase()}</span>
              <ChevronRight aria-hidden="true" className="size-3.5" />
            </Link>
          )}
        </div>
      </div>
      {children}
    </Card>
  );
}
