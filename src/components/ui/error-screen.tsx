"use client";

import { TriangleAlert } from "lucide-react";
import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { routes } from "@/config/routes";

/** Friendly "something went wrong" screen with a retry button (used by error.tsx files). */
export function ErrorScreen({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = error instanceof Error && "digest" in error ? String(error.digest) : null;
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl border border-danger/30 bg-danger/10 text-danger">
        <TriangleAlert aria-hidden="true" className="size-7" />
      </div>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Something went wrong</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          This page couldn&apos;t load. It&apos;s usually a brief connection problem, so try again in a moment.
        </p>
        {digest && <p className="mt-2 text-xs text-subtle">Error reference: {digest}</p>}
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Button onClick={() => retry()}>Try again</Button>
        <ButtonLink href={routes.dashboard} variant="secondary">
          Go to dashboard
        </ButtonLink>
      </div>
    </div>
  );
}
