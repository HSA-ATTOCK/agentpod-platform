import { BadgeCheck, Gauge, Lock } from "lucide-react";
import type { Metadata } from "next";
import { FinalCta } from "@/components/marketing/final-cta";
import { IconCard } from "@/components/marketing/icon-card";
import { PageHero } from "@/components/marketing/page-hero";
import { SectionHeading } from "@/components/marketing/section-heading";
import { legalConfig } from "@/config/legal";

export const metadata: Metadata = {
  title: "About",
  description:
    "Baba is one AI workspace that does real work for businesses, with human approval for anything sensitive. Learn about our mission and principles.",
};

const principles = [
  {
    icon: BadgeCheck,
    title: "Honesty",
    description:
      "Baba never fakes a result. If it can't find something, can't finish a step or isn't sure, it tells you plainly instead of making something up.",
    points: ["Research comes with its sources", "Failed steps are reported, not hidden"],
  },
  {
    icon: Lock,
    title: "Security",
    description:
      "Your business data belongs to you. Each workspace is isolated, secrets are encrypted and sensitive actions wait for a person to approve them.",
    points: ["API keys and connections stored encrypted", "Approval before emails, events and other sensitive actions"],
  },
  {
    icon: Gauge,
    title: "Control",
    description:
      "You decide what Baba can use and how much it can spend. Nothing runs away from you.",
    points: ["A spending cap on every task", "A monthly limit for the workspace"],
  },
] as const;

const details = [
  { label: "Company", value: legalConfig.companyName },
  { label: "Registered address", value: legalConfig.companyAddress },
  { label: "Country", value: legalConfig.country },
  { label: "Email", value: legalConfig.contactEmail },
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About Baba"
        title="One AI workspace that does real work for your business"
        description="Most AI tools give you suggestions. Baba gets the work done: it researches, writes, analyses and acts in your tools, while a person stays in charge of anything sensitive."
      />

      <section className="border-t border-border py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-6 text-2xl font-bold text-foreground sm:text-3xl">Our mission</h2>
          <div className="space-y-4 text-base leading-relaxed text-muted">
            <p>
              Small and growing businesses spend hours every week on research, reports, emails and spreadsheets. We
              think one AI workspace should be able to take on that work end to end, not just answer questions about it.
            </p>
            <p>
              Baba is built around a simple idea: you describe the result, Baba and its specialist agents do the work,
              and you approve anything that matters before it happens. That way you get the speed of AI with the
              judgement of the people who know your business.
            </p>
          </div>
        </div>
      </section>

      <section className="border-t border-border py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Principles"
            title="What we won't compromise on"
            description="These shape every feature we build."
          />
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {principles.map((principle) => (
              <IconCard
                key={principle.title}
                icon={principle.icon}
                title={principle.title}
                description={principle.description}
                points={principle.points}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-surface py-20" aria-labelledby="company-heading">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 id="company-heading" className="mb-6 text-2xl font-bold text-foreground sm:text-3xl">
            Company details
          </h2>
          <dl className="divide-y divide-border rounded-card border border-border bg-surface-raised">
            {details.map((item) => (
              <div key={item.label} className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:gap-6">
                <dt className="w-44 shrink-0 text-sm font-semibold text-foreground">{item.label}</dt>
                <dd className="text-sm text-muted">{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <FinalCta
        title="Work with Baba"
        description="Accounts are reviewed during early access. Request access and we'll set up your workspace."
        primaryLabel="Request access"
      />
    </>
  );
}
