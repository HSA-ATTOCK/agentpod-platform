import { ButtonLink } from "@/components/ui/button";
import { routes } from "@/config/routes";

type FinalCtaProps = {
  title?: string;
  description?: string;
  primaryLabel?: string;
};

export function FinalCta({
  title = "Ready to put your first agent to work?",
  description = "Create custom agents, automate your workflows and review everything from one dashboard.",
  primaryLabel = "Get started for free",
}: FinalCtaProps = {}) {
  return (
    <section className="border-t border-border py-20">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-card border border-border-strong bg-surface p-8 text-center sm:p-12">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-accent/10 blur-[80px]"
          />
          <h2 className="relative mb-4 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">{title}</h2>
          <p className="relative mx-auto mb-8 max-w-xl text-base text-muted sm:text-lg">{description}</p>
          <div className="relative flex flex-col items-center justify-center gap-4 sm:flex-row">
            <ButtonLink href={routes.signUp} size="lg" className="w-full px-8 sm:w-auto">
              {primaryLabel}
            </ButtonLink>
            <ButtonLink href={routes.signIn} variant="secondary" size="lg" className="w-full px-8 sm:w-auto">
              Sign in to your workspace
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
