import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/ui/logo";

type AuthSplitLayoutProps = {
  /** Small pill above the headline on the left panel. */
  badge: { icon: LucideIcon; label: string };
  headline: string;
  description: string;
  /** Optional extra content under the description (e.g. a checklist). */
  extras?: ReactNode;
  footnote: string;
  /** Link shown at the top right on phones. */
  mobileLink: { href: string; label: string };
  /** The form side. */
  children: ReactNode;
};

/**
 * Two-column card used by all auth pages.
 * Large screens: brand panel on the left, form on the right.
 * Phones: logo + form only.
 */
export function AuthSplitLayout({
  badge: { icon: BadgeIcon, label: badgeLabel },
  headline,
  description,
  extras,
  footnote,
  mobileLink,
  children,
}: AuthSplitLayoutProps) {
  return (
    <div className="grid w-full max-w-5xl grid-cols-1 overflow-hidden rounded-card border border-border bg-surface shadow-2xl lg:min-h-[640px] lg:grid-cols-12">
      {/* Brand panel (large screens only) */}
      <div className="relative hidden flex-col justify-between overflow-hidden border-r border-border bg-surface-raised/50 p-10 lg:col-span-5 lg:flex">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-20 -top-20 size-72 rounded-full bg-accent/10 blur-[100px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-20 -right-20 size-72 rounded-full bg-accent/5 blur-[100px]"
        />

        <div className="relative z-10">
          <Logo />
        </div>

        <div className="relative z-10 my-auto space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-accent">
            <BadgeIcon aria-hidden="true" className="size-3.5" />
            {badgeLabel}
          </div>
          <h2 className="text-2xl font-bold leading-snug text-foreground">{headline}</h2>
          <p className="text-sm leading-relaxed text-muted">{description}</p>
          {extras}
        </div>

        <p className="relative z-10 border-t border-border pt-6 text-xs text-subtle">{footnote}</p>
      </div>

      {/* Form panel */}
      <div className="col-span-1 flex flex-col justify-center p-6 sm:p-10 md:p-12 lg:col-span-7">
        <div className="mb-8 flex items-center justify-between lg:hidden">
          <Logo size="sm" />
          <Link
            href={mobileLink.href}
            className="rounded-md px-1 py-2 text-xs text-muted transition-colors hover:text-foreground"
          >
            {mobileLink.label}
          </Link>
        </div>
        <div className="mx-auto w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
