import { Cpu } from "lucide-react";
import Link from "next/link";
import { routes } from "@/config/routes";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

type LogoProps = {
  size?: "sm" | "md";
  /** Where the logo links to. Defaults to the home page. */
  href?: string;
  className?: string;
};

/** AgentPod mark + wordmark, linking home. */
export function Logo({ size = "md", href = routes.home, className }: LogoProps) {
  const small = size === "sm";
  return (
    <Link
      href={href}
      className={cn("group flex w-fit items-center gap-2.5 rounded-lg", className)}
    >
      <span
        className={cn(
          "flex items-center justify-center rounded-xl border border-accent/30 bg-accent/15 text-accent transition-transform group-hover:scale-105",
          small ? "size-8" : "size-9",
        )}
      >
        <Cpu aria-hidden="true" className={small ? "size-4" : "size-5"} />
      </span>
      <span className={cn("font-bold tracking-tight text-foreground", small ? "text-lg" : "text-xl")}>
        {siteConfig.name}
      </span>
    </Link>
  );
}
