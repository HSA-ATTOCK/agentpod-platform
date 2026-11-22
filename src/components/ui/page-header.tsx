import type { ReactNode } from "react";
import { Badge } from "./badge";

type PageHeaderProps = {
  title: string;
  description?: string;
  /** Shows the blue "Sample data" badge next to the title. */
  sample?: boolean;
  actions?: ReactNode;
};

/** Title row at the top of each app page. */
export function PageHeader({ title, description, sample, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{title}</h1>
          {sample && (
            <Badge tone="info" title="Example content. Real data will appear here once these features are connected.">
              Sample data
            </Badge>
          )}
        </div>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
