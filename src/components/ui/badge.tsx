import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type BadgeTone = "success" | "warning" | "danger" | "info" | "neutral" | "accent";

const toneClasses: Record<BadgeTone, string> = {
  success: "border-success/30 bg-success/15 text-success",
  warning: "border-warning/30 bg-warning/15 text-warning",
  danger: "border-danger/30 bg-danger/15 text-danger",
  info: "border-info/30 bg-info/15 text-info",
  neutral: "border-subtle/30 bg-subtle/15 text-muted",
  accent: "border-accent/30 bg-accent/15 text-accent",
};

type BadgeProps = {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
  title?: string;
};

/** Small rounded label. */
export function Badge({ tone = "neutral", children, className, title }: BadgeProps) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
