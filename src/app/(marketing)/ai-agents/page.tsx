import {
  ClipboardCheck,
  Globe,
  Landmark,
  Megaphone,
  MessageSquareText,
  Palette,
  PenLine,
  Search,
  Sheet,
} from "lucide-react";
import type { Metadata } from "next";
import { FinalCta } from "@/components/marketing/final-cta";
import { IconCard } from "@/components/marketing/icon-card";
import { PageHero } from "@/components/marketing/page-hero";
import { SectionHeading } from "@/components/marketing/section-heading";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { routes } from "@/config/routes";

export const metadata: Metadata = {
  title: "AI Agents",
  description:
    "Ask Baba once and it hands each part of the job to a specialist: Research Analyst, Writer, Data Analyst, QA Reviewer, Website Builder, Designer, Marketing & SEO and Finance Analyst.",
};

const agents = [
  {
    icon: Search,
    name: "Research Analyst",
    summary: "Researches topics on the web and reports back with its sources.",
    points: ["Market, competitor and company research", "Summaries with links to every source", "Fact-finding for other agents' work"],
  },
  {
    icon: PenLine,
    name: "Writer",
    summary: "Writes and edits business documents in your voice.",
    points: ["Reports, proposals and briefs", "Emails and announcements", "Delivered as Word, PDF or Markdown files"],
  },
  {
    icon: Sheet,
    name: "Data Analyst",
    summary: "Works through spreadsheets and data to find what matters.",
    points: ["Analyses CSV and Excel files", "Builds charts and summary tables", "Exports cleaned data as Excel"],
  },
  {
    icon: ClipboardCheck,
    name: "QA Reviewer",
    summary: "Checks work before it reaches you.",
    points: ["Reviews documents and results for mistakes", "Checks the work against what you asked for", "Flags gaps instead of hiding them"],
  },
  {
    icon: Globe,
    name: "Website Builder",
    summary: "Builds websites and landing pages you can try straight away.",
    points: ["Pages built from your description", "A preview link to open the site", "Changes made by asking in the chat"],
  },
  {
    icon: Palette,
    name: "Designer",
    summary: "Turns ideas into clear design specifications.",
    points: ["Layouts, colours and typography", "Design specs your team or builder can follow", "Structure for pages, slides and documents"],
  },
  {
    icon: Megaphone,
    name: "Marketing & SEO",
    summary: "Plans how to reach the right customers.",
    points: ["Marketing and campaign plans", "SEO keyword and content plans", "Draft copy for campaigns and pages"],
  },
  {
    icon: Landmark,
    name: "Finance Analyst",
    summary: "Analyses the financial data you provide.",
    points: ["Works from spreadsheets and exports you share", "Summaries, trends and comparisons", "Clear tables and charts for reporting"],
  },
] as const;

const steps = [
  {
    title: "You ask Baba",
    description: "Describe the result you want in one message, with any files that help.",
  },
  {
    title: "Baba plans and delegates",
    description: "Baba splits the work into steps and hands each one to the specialist best suited to it.",
  },
  {
    title: "You review the result",
    description: "Baba brings the pieces together, asks before any sensitive action and gives you the finished work.",
  },
];

export default function AiAgentsPage() {
  return (
    <>
      <PageHero
        eyebrow="AI agents"
        title="A team of specialists behind one conversation"
        description="You talk to Baba. Baba hands each part of the job to the specialist agent that does it best, then brings the results back to you."
      >
        <ButtonLink href={routes.signUp} size="lg" className="w-full sm:w-auto">
          Request access
        </ButtonLink>
        <ButtonLink href={routes.features} variant="secondary" size="lg" className="w-full sm:w-auto">
          See all features
        </ButtonLink>
      </PageHero>

      <section className="border-t border-border py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="How delegation works"
            title="Ask once, get the whole job done"
            description="You don't need to pick an agent. Baba decides who should do what."
          />
          <ol className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {steps.map((step, index) => (
              <li key={step.title} className="rounded-card border border-border bg-surface p-7">
                <span aria-hidden="true" className="mb-4 block text-4xl font-extrabold text-border-strong">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="mb-2 text-lg font-semibold text-foreground">
                  <span className="sr-only">Step {index + 1}: </span>
                  {step.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted">{step.description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-t border-border py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="The specialists"
            title="Who Baba works with"
            description="Each specialist has its own instructions and tools, focused on one kind of work."
          />
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            <IconCard
              icon={MessageSquareText}
              title="Baba"
              description="Your main assistant. Plans the work, delegates, uses your connected tools and asks for approval when needed."
              points={["Understands your business instructions", "Coordinates every specialist", "Works in Gmail, Drive and Calendar"]}
              badge={<Badge tone="accent">Lead</Badge>}
              className="border-border-strong"
            />
            {agents.map((agent) => (
              <IconCard
                key={agent.name}
                icon={agent.icon}
                title={agent.name}
                description={agent.summary}
                points={agent.points}
                badge={<Badge tone="success">Available</Badge>}
              />
            ))}
          </div>
        </div>
      </section>

      <FinalCta
        title="Put the whole team to work"
        description="Accounts are reviewed during early access. Request access and we'll set up your workspace."
        primaryLabel="Request access"
      />
    </>
  );
}
