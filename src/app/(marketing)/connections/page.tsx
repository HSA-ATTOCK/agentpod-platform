import { CalendarDays, Database, FolderOpen, KeyRound, Mail, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { FinalCta } from "@/components/marketing/final-cta";
import { IconCard } from "@/components/marketing/icon-card";
import { PageHero } from "@/components/marketing/page-hero";
import { SectionHeading } from "@/components/marketing/section-heading";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { routes } from "@/config/routes";

export const metadata: Metadata = {
  title: "Integrations",
  description:
    "Connect Gmail, Google Drive and Google Calendar, any REST API with a securely stored API key, and read-only PostgreSQL or MySQL databases.",
};

const google = [
  {
    icon: Mail,
    title: "Gmail",
    description: "Baba reads and searches your inbox, drafts replies and sends email once you approve it.",
    points: ["Read and search email", "Draft messages", "Send only after your approval"],
  },
  {
    icon: FolderOpen,
    title: "Google Drive",
    description: "Find and read your documents, and save the files Baba creates straight to Drive.",
    points: ["Search and read files", "Read Google Docs, including long ones", "Save results to Drive"],
  },
  {
    icon: CalendarDays,
    title: "Google Calendar",
    description: "Check what's coming up and add events when you say so.",
    points: ["List upcoming events", "Create events after your approval"],
  },
] as const;

const more = [
  {
    icon: KeyRound,
    title: "Any REST API",
    description:
      "Give Baba an API key for a service you use and it can call that service's API. Keys are stored encrypted and locked to the address they were saved for, so they can't be sent anywhere else.",
  },
  {
    icon: Database,
    title: "PostgreSQL and MySQL",
    description:
      "Connect a database with read-only access so Baba can answer questions and build reports from your own data, without being able to change it.",
  },
  {
    icon: Users,
    title: "Several Google accounts",
    description:
      "Connect more than one Google account to a workspace, for example a shared inbox and a personal one, and tell Baba which to use.",
  },
] as const;

const viaApiKey = [
  "Slack",
  "HubSpot",
  "QuickBooks",
  "Stripe",
  "GitHub",
  "Shopify",
  "Notion",
  "Airtable",
  "Salesforce",
  "Xero",
  "Mailchimp",
  "Zendesk",
];

export default function ConnectionsPage() {
  return (
    <>
      <PageHero
        eyebrow="Integrations"
        title="Baba works where your business already does"
        description="Connect your Google account, your own APIs and your databases. You choose what Baba can use, and sensitive actions always wait for your approval."
      >
        <ButtonLink href={routes.signUp} size="lg" className="w-full sm:w-auto">
          Request access
        </ButtonLink>
        <ButtonLink href={routes.contact} variant="secondary" size="lg" className="w-full sm:w-auto">
          Ask about a tool
        </ButtonLink>
      </PageHero>

      <section className="border-t border-border py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Google Workspace"
            title="Gmail, Drive and Calendar"
            description="Sign in with Google from the chat and Baba can start using these straight away."
          />
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {google.map((item) => (
              <IconCard
                key={item.title}
                icon={item.icon}
                title={item.title}
                description={item.description}
                points={item.points}
                badge={<Badge tone="success">Available</Badge>}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Your own systems"
            title="APIs, databases and more accounts"
            description="Bring in the tools and data that are specific to your business."
          />
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {more.map((item) => (
              <IconCard
                key={item.title}
                icon={item.icon}
                title={item.title}
                description={item.description}
                badge={<Badge tone="success">Available</Badge>}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-surface py-20" aria-labelledby="api-key-heading">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-accent">Other tools</p>
            <h2 id="api-key-heading" className="text-2xl font-bold text-foreground sm:text-3xl">
              Through API key / coming soon
            </h2>
            <p className="mt-4 text-base text-muted">
              These aren&apos;t native integrations yet. If the service offers a REST API, you can connect it today with
              an API key and Baba will call it for you. Ready-made connections are on our roadmap.
            </p>
          </div>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {viaApiKey.map((name) => (
              <li
                key={name}
                className="flex flex-col items-start gap-2 rounded-control border border-border bg-surface-raised px-4 py-3"
              >
                <span className="text-sm font-medium text-foreground">{name}</span>
                <Badge tone="neutral">API key</Badge>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-center text-sm text-muted">
            Need a tool that isn&apos;t listed?{" "}
            <Link href={routes.contact} className="font-medium text-accent hover:underline">
              Tell us what you use
            </Link>
            .
          </p>
        </div>
      </section>

      <FinalCta
        title="Connect your tools and let Baba do the busywork"
        description="Accounts are reviewed during early access. Request access and we'll set up your workspace."
        primaryLabel="Request access"
      />
    </>
  );
}
