import Link from "next/link";
import type { ReactNode } from "react";

/** "Don't have an account? Sign up" row at the bottom of auth forms. */
export function AuthFooterLink({
  text,
  href,
  linkLabel,
  icon,
}: {
  text: string;
  href: string;
  linkLabel: string;
  icon?: ReactNode;
}) {
  return (
    <div className="mt-8 border-t border-border pt-6 text-center text-xs text-muted">
      {text}{" "}
      <Link
        href={href}
        className="ml-1 inline-flex items-center gap-1 font-semibold text-accent hover:underline"
      >
        {icon}
        {linkLabel}
      </Link>
    </div>
  );
}
