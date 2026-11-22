"use client";

import { Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { routes } from "@/config/routes";

const sectionLinks = [
  { label: "Features", href: "#features" },
  { label: "Use cases", href: "#use-cases" },
  { label: "How it works", href: "#how-it-works" },
];

export function MarketingNavbar() {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

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

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Logo />

        <nav aria-label="Main" className="hidden items-center gap-8 text-sm font-medium text-muted md:flex">
          {sectionLinks.map((link) => (
            <a key={link.href} href={link.href} className="transition-colors hover:text-foreground">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
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
          className="flex size-11 items-center justify-center rounded-control border border-border text-muted transition-colors hover:bg-surface-raised hover:text-foreground md:hidden"
        >
          {open ? <X aria-hidden="true" className="size-5" /> : <Menu aria-hidden="true" className="size-5" />}
        </button>
      </div>

      {open && (
        <div id="mobile-menu" className="space-y-4 border-b border-border bg-surface px-4 pb-6 pt-3 md:hidden">
          <nav aria-label="Main" className="flex flex-col gap-1 text-base font-medium text-muted">
            {sectionLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-2 py-2.5 hover:bg-surface-raised hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div className="flex flex-col gap-2.5 border-t border-border pt-4">
            <ButtonLink href={routes.signIn} variant="secondary" fullWidth size="lg">
              Sign in
            </ButtonLink>
            <ButtonLink href={routes.signUp} fullWidth size="lg">
              Get started
            </ButtonLink>
          </div>
        </div>
      )}
    </header>
  );
}
