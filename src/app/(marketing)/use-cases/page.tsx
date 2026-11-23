import { Briefcase, Globe, Headphones, Landmark, Megaphone, Search, Target, Users } from "lucide-react";
import type { Metadata } from "next";
import { FinalCta } from "@/components/marketing/final-cta";
import { CheckList } from "@/components/marketing/icon-card";
import { PageHero } from "@/components/marketing/page-hero";
import { SectionHeading } from "@/components/marketing/section-heading";
import { ButtonLink } from "@/components/ui/button";
import { routes } from "@/config/routes";

export const metadata: Metadata = {
  title: "Use cases",
  description:
    "How teams use Baba for sales research, customer emails, reports, marketing and SEO plans, websites, finance analysis and research.",
};

const useCases = [
  {
    icon: Target,
    team: "Sales",
    example: "Research these 10 companies, find what each one does and draft a short intro email to each.",
    tasks: [
      "Research prospects on the web, with sources",
      "Draft personal follow-up emails in Gmail for you to approve",
      "Prepare meeting briefs from your calendar",
    ],
    uses: "Research Analyst, Writer, Gmail, Google Calendar",
  },
  {
    icon: Headphones,
    team: "Customer service",
    example: "Find this week's unanswered customer emails and draft replies using our returns policy in Drive.",
    tasks: [
      "Search your inbox for messages that need a reply",
      "Draft answers based on your own documents",
      "Send replies only after you approve each one",
    ],
    uses: "Writer, Gmail, Google Drive",
  },
  {
    icon: Briefcase,
    team: "Operations",
    example: "Every Monday at 9am, turn last week's order spreadsheet into a summary report with charts.",
    tasks: [
      "Scheduled reports that run by themselves",
      "Summaries of long documents and PDFs",
      "Read-only questions answered from your database",
    ],
    uses: "Data Analyst, Writer, Workflows, Database connections",
  },
  {
    icon: Megaphone,
    team: "Marketing",
    example: "Research our three main competitors and write an SEO content plan for the next quarter.",
    tasks: [
      "Competitor and market research",
      "Marketing and SEO plans",
      "Draft copy for campaigns, emails and pages",
    ],
    uses: "Research Analyst, Marketing & SEO, Writer",
  },
  {
    icon: Globe,
    team: "Websites and design",
    example: "Build a landing page for our new service and send me the preview link.",
    tasks: [
      "Landing pages and simple websites with a preview link",
      "Design specs for layouts, colours and typography",
      "Changes made by asking in the chat",
    ],
    uses: "Website Builder, Designer, QA Reviewer",
  },
  {
    icon: Landmark,
    team: "Finance",
    example: "Here's our expenses export. Show me where spending grew most this year, as an Excel file and a chart.",
    tasks: [
      "Analysis of the spreadsheets and exports you share",
      "Trends, comparisons and summary tables",
      "Results as Excel, PDF or PowerPoint files",
    ],
    uses: "Finance Analyst, Data Analyst",
  },
  {
    icon: Search,
    team: "Research and strategy",
    example: "What are the main regulations for selling food online in our country? Give me a report with sources.",
    tasks: [
      "Desk research with every source linked",
      "Reports and briefing documents",
      "A review step that checks the work against your request",
    ],
    uses: "Research Analyst, Writer, QA Reviewer",
  },
  {
    icon: Users,
    team: "Management",
    example: "Read the attached board pack and give me a one-page summary with the five decisions we need to make.",
    tasks: [
      "Summaries of reports, decks and spreadsheets",
      "Presentations as PowerPoint files",
      "One workspace your whole team can use, with roles",
    ],
    uses: "Writer, Data Analyst",
  },
] as const;

export default function UseCasesPage() {
  return (
    <>
      <PageHero
        eyebrow="Use cases"
        title="Real work, handled for every team"
        description="Here are some of the ways businesses use Baba today. Each example is a single request you could type into Ask Baba."
      >
        <ButtonLink href={routes.signUp} size="lg" className="w-full sm:w-auto">
          Request access
        </ButtonLink>
        <ButtonLink href={routes.connections} variant="secondary" size="lg" className="w-full sm:w-auto">
          See integrations
        </ButtonLink>
      </PageHero>

      <section className="border-t border-border py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="By team"
            title="What you can ask for"
            description="Baba picks the right specialists and tools for each request, and asks before anything sensitive."
          />
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {useCases.map((useCase) => (
              <article key={useCase.team} className="flex flex-col rounded-card border border-border bg-surface p-6 sm:p-7">
                <div className="mb-5 flex items-center gap-3">
                  <div className="rounded-lg border border-border bg-surface-raised p-2 text-accent">
                    <useCase.icon aria-hidden="true" className="size-5" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">{useCase.team}</h3>
                </div>
                <figure className="mb-5 rounded-control border border-border bg-surface-raised p-4">
                  <figcaption className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-subtle">
                    Example request
                  </figcaption>
                  <blockquote className="text-sm leading-relaxed text-foreground">&ldquo;{useCase.example}&rdquo;</blockquote>
                </figure>
                <CheckList items={useCase.tasks} />
                <p className="mt-auto pt-5 text-xs text-subtle">
                  <span className="font-semibold text-muted">Uses:</span> {useCase.uses}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <FinalCta
        title="Have a task in mind?"
        description="Accounts are reviewed during early access. Request access, or tell us what you'd like Baba to do."
        primaryLabel="Request access"
      />
    </>
  );
}
