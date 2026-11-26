import {
  CalendarClock,
  FileDown,
  Gauge,
  KeyRound,
  ListChecks,
  MessageSquareText,
  Paperclip,
  Radio,
  ShieldCheck,
  Timer,
  Users,
  Webhook,
} from "lucide-react";
import type { Metadata } from "next";
import { FinalCta } from "@/components/marketing/final-cta";
import { IconCard } from "@/components/marketing/icon-card";
import { PageHero } from "@/components/marketing/page-hero";
import { SectionHeading } from "@/components/marketing/section-heading";
import { ButtonLink } from "@/components/ui/button";
import { routes } from "@/config/routes";

export const metadata: Metadata = {
  title: "Features",
  description:
    "Ask Baba plans and does real work in one conversation: attachments, downloadable files, approvals before sensitive actions, spending caps, scheduled workflows and team workspaces.",
};

const groups = [
  {
    id: "ask-baba",
    eyebrow: "Ask Baba",
    title: "One conversation that plans and does the work",
    description:
      "Describe what you need in plain language. Baba works out the steps, hands parts to specialist agents and shows you its progress as it goes.",
    items: [
      {
        icon: MessageSquareText,
        title: "Plans, then does",
        description:
          "Baba breaks a request into steps and carries them out: researching, writing, analysing data or using your connected tools.",
      },
      {
        icon: Radio,
        title: "Live progress",
        description:
          "Answers stream in as they're written, and you can see each step Baba takes while it works.",
      },
      {
        icon: Timer,
        title: "Keeps running in the background",
        description:
          "Long tasks carry on when you switch to another chat or close the tab. Come back to the finished result.",
      },
      {
        icon: Paperclip,
        title: "Attach your files",
        description:
          "Add images, PDFs, CSV and Excel spreadsheets or documents to a message, and Baba reads them as part of the task.",
      },
      {
        icon: FileDown,
        title: "Files you can download",
        description:
          "Get the output as a real file: Word (DOCX), PDF, PowerPoint (PPTX), Excel (XLSX) or Markdown.",
      },
    ],
  },
  {
    id: "control",
    eyebrow: "Control",
    title: "Nothing sensitive happens without you",
    description: "Baba asks before it acts on your behalf, and it can't spend more than you allow.",
    items: [
      {
        icon: ShieldCheck,
        title: "Approval cards",
        description:
          "Before sending an email, creating a calendar event or another sensitive action, Baba shows you exactly what it wants to do and waits for your OK.",
      },
      {
        icon: Gauge,
        title: "Spending caps",
        description:
          "Set a spending cap per task and a monthly limit for the workspace. A task that reaches its cap pauses until you choose to continue.",
      },
      {
        icon: KeyRound,
        title: "Secrets stay secret",
        description:
          "API keys and account connections are stored encrypted, and an API key can only be used with the address it was saved for.",
      },
    ],
  },
  {
    id: "workflows",
    eyebrow: "Workflows",
    title: "Save a task once, run it whenever you need",
    description: "Turn a request you make often into a workflow that runs by itself.",
    items: [
      {
        icon: CalendarClock,
        title: "On a schedule",
        description:
          "Run a saved task every day, every week or every month at the time you choose, in your workspace's timezone.",
      },
      {
        icon: ListChecks,
        title: "On demand",
        description: "Start any saved workflow with one click and see the result in its conversation.",
      },
      {
        icon: Webhook,
        title: "By webhook",
        description: "Trigger a workflow from another system by calling its webhook address.",
      },
    ],
  },
  {
    id: "teams",
    eyebrow: "Teams",
    title: "Built for working together",
    description: "Each business gets its own private workspace, with the right access for each person.",
    items: [
      {
        icon: Users,
        title: "Workspaces and invites",
        description:
          "Invite your team by email. Every workspace is kept separate, so other businesses never see your data.",
      },
      {
        icon: ShieldCheck,
        title: "Roles",
        description:
          "Give each person the role that fits: owner, admin, member or viewer. Viewers can see work without changing anything.",
      },
      {
        icon: KeyRound,
        title: "Two-step verification",
        description: "Protect accounts with a second sign-in step using an authenticator app.",
      },
    ],
  },
] as const;

export default function FeaturesPage() {
  return (
    <>
      <PageHero
        eyebrow="Features"
        title="An AI workspace that gets real work done"
        description="Baba researches, writes, analyses data and works in your tools, with your approval before anything sensitive and a spending cap on every task."
      >
        <ButtonLink href={routes.signUp} size="lg" className="w-full sm:w-auto">
          Request access
        </ButtonLink>
        <ButtonLink href={routes.aiAgents} variant="secondary" size="lg" className="w-full sm:w-auto">
          Meet the agents
        </ButtonLink>
      </PageHero>

      {groups.map((group) => (
        <section key={group.id} id={group.id} className="scroll-mt-16 border-t border-border py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionHeading eyebrow={group.eyebrow} title={group.title} description={group.description} />
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {group.items.map((item) => (
                <IconCard key={item.title} icon={item.icon} title={item.title} description={item.description} />
              ))}
            </div>
          </div>
        </section>
      ))}

      <FinalCta
        title="See what Baba can do for your business"
        description="Accounts are reviewed during early access. Request access and we'll get your workspace set up."
        primaryLabel="Request access"
      />
    </>
  );
}
