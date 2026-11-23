import { Info } from "lucide-react";
import type { Metadata } from "next";
import { CheckList } from "@/components/marketing/icon-card";
import { PageHero } from "@/components/marketing/page-hero";
import { SectionHeading } from "@/components/marketing/section-heading";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { routes } from "@/config/routes";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Baba plans for every size of business, from a free trial to Enterprise. Pricing is being finalised; during early access our team sets up your plan.",
};

const plans = [
  {
    name: "Free trial",
    audience: "Try Baba with real work before you commit.",
    features: [
      "Ask Baba with all specialist agents",
      "Attachments and downloadable files",
      "Gmail, Drive and Calendar connections",
      "Trial usage limit",
    ],
    cta: { label: "Request access", href: routes.signUp },
  },
  {
    name: "Starter",
    audience: "For individuals and small teams getting started.",
    features: [
      "Everything in the free trial",
      "Saved workflows on a schedule or on demand",
      "Invite a small team",
      "Spending caps per task and per month",
    ],
    cta: { label: "Request access", href: routes.signUp },
  },
  {
    name: "Professional",
    audience: "For growing teams that automate everyday work.",
    features: [
      "Everything in Starter",
      "Any REST API through a secure API key",
      "Read-only PostgreSQL and MySQL connections",
      "Several Google accounts per workspace",
      "Workflows triggered by webhook",
    ],
    cta: { label: "Request access", href: routes.signUp },
    highlight: true,
  },
  {
    name: "Business",
    audience: "For larger teams with more people and more work.",
    features: [
      "Everything in Professional",
      "Higher usage limits",
      "More team members, with owner, admin, member and viewer roles",
      "Two-step verification for your team",
    ],
    cta: { label: "Contact us", href: routes.contact },
  },
  {
    name: "Enterprise",
    audience: "For organisations with specific needs.",
    features: [
      "Everything in Business",
      "Limits set to match your usage",
      "Help setting up your connections and workflows",
      "Custom terms and invoicing",
    ],
    cta: { label: "Contact us", href: routes.contact },
  },
] as const;

const faqs = [
  {
    question: "How does early access work?",
    answer:
      "Request access by creating an account. Our team reviews every new sign-up, and once your account is approved you can start using Baba. We'll agree a plan with you during setup.",
  },
  {
    question: "How will I be charged during early access?",
    answer:
      "During early access, usage is billed at cost and plans are set up by our team. There's no automatic billing in the app yet; our team agrees the details with you directly.",
  },
  {
    question: "Can I control how much Baba spends?",
    answer:
      "Yes. Every task has a spending cap and your workspace has a monthly limit, both set by you. When a task reaches its cap it pauses and waits for you to decide whether to continue.",
  },
  {
    question: "Do the plans above include prices?",
    answer:
      "Not yet. Pricing is being finalised, and the features of each plan may change before launch. Contact us if you'd like to talk about what fits your business.",
  },
];

export default function PricingPage() {
  return (
    <>
      <PageHero
        eyebrow="Pricing"
        title="Plans for every size of business"
        description="Start with a free trial and grow into the plan that fits your team."
      />

      <section className="pb-20" aria-label="Plans">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div
            role="note"
            className="mx-auto mb-10 flex max-w-3xl items-start gap-3 rounded-control border border-info/30 bg-info/10 p-4 text-sm leading-relaxed text-muted"
          >
            <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-info" />
            <p>
              <strong className="text-foreground">Pricing is being finalised.</strong> During early access, usage is
              billed at cost and plans are set up by our team.
            </p>
          </div>

          <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {plans.map((plan) => {
              const highlight = "highlight" in plan && plan.highlight;
              return (
                <li
                  key={plan.name}
                  className={cn(
                    "flex flex-col rounded-card border bg-surface p-6",
                    highlight ? "border-accent/60 shadow-lg shadow-accent/5" : "border-border",
                  )}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h2 className="text-lg font-semibold text-foreground">{plan.name}</h2>
                    {highlight && <Badge tone="accent">Popular</Badge>}
                  </div>
                  <p className="mb-6 text-sm leading-relaxed text-muted">{plan.audience}</p>
                  <CheckList items={plan.features} className="mb-8" />
                  <ButtonLink
                    href={plan.cta.href}
                    variant={highlight ? "primary" : "secondary"}
                    fullWidth
                    className="mt-auto"
                  >
                    {plan.cta.label}
                  </ButtonLink>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="border-t border-border py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <SectionHeading eyebrow="Questions" title="Pricing questions" />
          <div className="space-y-3">
            {faqs.map((faq) => (
              <details key={faq.question} className="group rounded-card border border-border bg-surface p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold text-foreground [&::-webkit-details-marker]:hidden">
                  <h3>{faq.question}</h3>
                  <span aria-hidden="true" className="text-xl leading-none text-muted transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted">{faq.answer}</p>
              </details>
            ))}
          </div>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <ButtonLink href={routes.signUp} size="lg" className="w-full sm:w-auto">
              Request access
            </ButtonLink>
            <ButtonLink href={routes.contact} variant="secondary" size="lg" className="w-full sm:w-auto">
              Contact us
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
