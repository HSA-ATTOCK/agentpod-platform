import { cn } from "@/lib/utils";

/** "Sarah Connor" → "SC" */
export function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

/** Round avatar showing a person's initials. */
export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full border border-border-strong bg-gradient-to-tr from-border to-border-strong text-xs font-semibold text-foreground",
        className,
      )}
    >
      {getInitials(name)}
    </span>
  );
}
