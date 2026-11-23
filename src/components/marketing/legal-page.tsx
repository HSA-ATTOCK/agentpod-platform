import type { ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { legalConfig, legalIsDraft } from "@/config/legal";

/** Layout for the Terms and Privacy pages: readable width, headings, draft notice. */
export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:py-24">
      <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{title}</h1>
      <p className="mt-3 text-sm text-subtle">Effective {legalConfig.effectiveDate}</p>
      {legalIsDraft && (
        <Alert variant="warning" title="Draft" className="mt-6">
          This is a draft. The details in [brackets] still need to be filled in, and it should be reviewed by a lawyer
          before launch.
        </Alert>
      )}
      <div className="legal mt-10 space-y-8 text-sm leading-relaxed text-muted [&_h2]:mb-3 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_li]:mt-1.5 [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
        {children}
      </div>
    </article>
  );
}
