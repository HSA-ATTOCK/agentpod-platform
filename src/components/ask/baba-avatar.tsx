import { Cpu } from "lucide-react";
import { cn } from "@/lib/utils";

/** Baba's small logo mark, used as the avatar next to its messages. */
export function BabaAvatar({ size = "sm", className }: { size?: "sm" | "lg"; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center border border-accent/30 bg-accent/15 text-accent",
        size === "sm" ? "size-8 rounded-lg" : "size-12 rounded-xl",
        className,
      )}
    >
      <Cpu className={size === "sm" ? "size-4" : "size-6"} />
    </span>
  );
}

/** Lines up a block with Baba's messages (avatar column + content). */
export function BabaRow({
  children,
  showAvatar = true,
  className,
}: {
  children: React.ReactNode;
  showAvatar?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex w-full max-w-3xl items-start gap-3 sm:gap-4", className)}>
      {showAvatar ? <BabaAvatar className="mt-0.5" /> : <span aria-hidden="true" className="w-8 shrink-0" />}
      <div className="flex min-w-0 flex-1 flex-col gap-2">{children}</div>
    </div>
  );
}
