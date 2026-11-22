import { ArrowRight, Check, CirclePlay } from "lucide-react";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { routes } from "@/config/routes";
import { ProductPreview } from "./product-preview";

const highlights = ["Human approval for sensitive actions", "A private workspace per business"];

export function Hero() {
  return (
    <section className="relative overflow-hidden pb-20 pt-16 md:pb-28 md:pt-24">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/4 -z-10 h-[300px] w-full max-w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/5 blur-[140px]"
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-8">
          <div className="space-y-8 text-center lg:col-span-6 lg:text-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-raised px-3 py-1 text-xs font-medium text-muted">
              <span aria-hidden="true" className="size-2 animate-pulse rounded-full bg-accent" />
              AI agents for business automation
            </div>

            <h1 className="text-4xl font-extrabold leading-[1.15] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Put AI agents to work across your business
            </h1>

            <p className="mx-auto max-w-2xl text-lg leading-relaxed text-muted sm:text-xl lg:mx-0">
              Give your teams dedicated AI agents that research leads, handle customer questions,
              process documents and run multi-step workflows, with you in control of every
              sensitive step.
            </p>

            <div className="flex flex-col items-center justify-center gap-4 pt-2 sm:flex-row lg:justify-start">
              <ButtonLink href={routes.signUp} size="lg" className="w-full shadow-lg shadow-accent/10 sm:w-auto">
                Start free
                <ArrowRight aria-hidden="true" className="size-4" />
              </ButtonLink>
              <a href="#how-it-works" className={buttonClasses({ variant: "secondary", size: "lg", className: "w-full sm:w-auto" })}>
                <CirclePlay aria-hidden="true" className="size-4 text-muted" />
                See how it works
              </a>
            </div>

            <ul className="flex flex-col items-center justify-center gap-2 pt-4 text-xs text-subtle sm:flex-row sm:gap-6 lg:justify-start">
              {highlights.map((item) => (
                <li key={item} className="flex items-center gap-1.5">
                  <Check aria-hidden="true" className="size-3.5 text-accent" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="min-w-0 lg:col-span-6">
            <ProductPreview />
          </div>
        </div>
      </div>
    </section>
  );
}
