import type { LucideIcon } from "lucide-react";
import { CircleCheck } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Card with an icon tile, an h3 title, a description and an optional checklist, used on the public pages. */
export function IconCard({
  icon: Icon,
  title,
  description,
  points,
  badge,
  children,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  points?: readonly string[];
  badge?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col rounded-card border border-border bg-surface p-6 sm:p-7", className)}>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="flex size-11 items-center justify-center rounded-control border border-border bg-surface-raised text-accent">
          <Icon aria-hidden="true" className="size-5" />
        </div>
        {badge}
      </div>
      <h3 className="mb-2 text-lg font-semibold text-foreground">{title}</h3>
      {description && <p className="text-sm leading-relaxed text-muted">{description}</p>}
      {points && points.length > 0 && <CheckList items={points} className="mt-4" />}
      {children}
    </div>
  );
}

/** Ticked list of short points. */
export function CheckList({ items, className }: { items: readonly string[]; className?: string }) {
  return (
    <ul className={cn("space-y-2.5 text-sm text-muted", className)}>
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2.5">
          <CircleCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-accent" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
