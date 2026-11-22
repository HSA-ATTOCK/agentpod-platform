import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Rounded panel with the standard surface color and border. */
export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-card border border-border bg-surface", className)}
      {...props}
    />
  );
}
