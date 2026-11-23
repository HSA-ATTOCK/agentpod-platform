import { Compass } from "lucide-react";
import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { routes } from "@/config/routes";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-1 flex-col items-center justify-center gap-8 px-4 py-16 text-center">
      <Logo />
      <div className="flex size-14 items-center justify-center rounded-2xl border border-border bg-surface text-accent">
        <Compass aria-hidden="true" className="size-7" />
      </div>
      <div>
        <p className="text-sm font-semibold text-accent">404</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">We couldn&apos;t find that page</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">The link may be broken, or the page may have been moved or deleted.</p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <ButtonLink href={routes.ask}>Go to Ask Baba</ButtonLink>
        <ButtonLink href={routes.home} variant="secondary">
          Home page
        </ButtonLink>
      </div>
    </main>
  );
}
