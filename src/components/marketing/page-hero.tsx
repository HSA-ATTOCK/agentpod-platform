import type { ReactNode } from "react";

/** Top of a public website page: eyebrow, the page's h1, a short intro and optional actions. */
export function PageHero({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden pb-16 pt-16 md:pb-20 md:pt-24">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/3 -z-10 h-[260px] w-full max-w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/5 blur-[140px]"
      />
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-accent">{eyebrow}</p>
        <h1 className="text-4xl font-extrabold leading-[1.15] tracking-tight text-foreground sm:text-5xl">{title}</h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted">{description}</p>
        {children && (
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">{children}</div>
        )}
      </div>
    </section>
  );
}
