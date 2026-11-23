"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { routes } from "@/config/routes";
import { cn } from "@/lib/utils";

const mainLinks = [
  { label: "Features", href: routes.features },
  { label: "AI Agents", href: routes.aiAgents },
  { label: "Integrations", href: routes.connections },
  { label: "Use cases", href: routes.useCases },
  { label: "Pricing", href: routes.pricing },
];

// Shown in the mobile menu only (they're in the footer on larger screens)
const moreLinks = [
  { label: "About", href: routes.about },
  { label: "Contact", href: routes.contact },
];

export function MarketingNavbar() {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  // Close the mobile menu with Escape and return focus to the menu button
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const current = (href: string) => (pathname === href ? "page" : undefined);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Logo />

        <nav aria-label="Main" className="hidden items-center gap-7 text-sm font-medium text-muted lg:flex">
          {mainLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={current(link.href)}
              className={cn("transition-colors hover:text-foreground", current(link.href) && "text-foreground")}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <ButtonLink href={routes.signIn} variant="ghost">
            Sign in
          </ButtonLink>
          <ButtonLink href={routes.signUp}>Get started</ButtonLink>
        </div>

        <button
          ref={buttonRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="mobile-menu"
          className="flex size-11 items-center justify-center rounded-control border border-border text-muted transition-colors hover:bg-surface-raised hover:text-foreground lg:hidden"
        >
          {open ? <X aria-hidden="true" className="size-5" /> : <Menu aria-hidden="true" className="size-5" />}
        </button>
      </div>

      {open && (
        <div id="mobile-menu" className="space-y-4 border-b border-border bg-surface px-4 pb-6 pt-3 lg:hidden">
          <nav aria-label="Main" className="flex flex-col gap-1 text-base font-medium text-muted">
            {[...mainLinks, ...moreLinks].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={current(link.href)}
                onClick={() => setOpen(false)}
                className={cn(
                  "rounded-md px-2 py-2.5 hover:bg-surface-raised hover:text-foreground",
                  current(link.href) && "bg-surface-raised text-foreground",
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="flex flex-col gap-2.5 border-t border-border pt-4">
            <ButtonLink href={routes.signIn} variant="secondary" fullWidth size="lg" onClick={() => setOpen(false)}>
              Sign in
            </ButtonLink>
            <ButtonLink href={routes.signUp} fullWidth size="lg" onClick={() => setOpen(false)}>
              Get started
            </ButtonLink>
          </div>
        </div>
      )}
    </header>
  );
}
