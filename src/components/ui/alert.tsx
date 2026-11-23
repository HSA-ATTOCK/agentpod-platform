import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type AlertVariant = "error" | "success" | "info" | "warning";

const styles: Record<AlertVariant, { box: string; icon: typeof Info }> = {
  error: { box: "border-danger/30 bg-danger/10 text-danger", icon: CircleAlert },
  success: { box: "border-success/30 bg-success/10 text-success", icon: CircleCheck },
  info: { box: "border-info/30 bg-info/10 text-info", icon: Info },
  warning: { box: "border-warning/30 bg-warning/10 text-warning", icon: TriangleAlert },
};

type AlertProps = {
  variant?: AlertVariant;
  title?: string;
  children: ReactNode;
  className?: string;
};

/** A message box. Errors are announced immediately to screen readers. */
export function Alert({ variant = "info", title, children, className }: AlertProps) {
  const { box, icon: Icon } = styles[variant];
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cn("flex items-start gap-2.5 rounded-control border p-3.5 text-xs leading-relaxed", box, className)}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div>
        {title && <p className="mb-0.5 text-sm font-semibold text-foreground">{title}</p>}
        <div className={title ? "text-muted" : undefined}>{children}</div>
      </div>
    </div>
  );
}
