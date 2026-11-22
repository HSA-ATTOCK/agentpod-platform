import { Bot, GitMerge, PlugZap, ScrollText, ShieldCheck, Users } from "lucide-react";
import { SectionHeading } from "./section-heading";

const features = [
  {
    icon: Bot,
    title: "Custom AI agents",
    description:
      "Create agents for specific jobs with their own instructions, responsibilities and the exact tools they're allowed to use.",
  },
  {
    icon: GitMerge,
    title: "Multi-step workflows",
    description:
      "Chain agents and tools into workflows that pass context between steps and automate your playbooks end to end.",
  },
  {
    icon: PlugZap,
    title: "Business integrations",
    description:
      "Connect the tools you already use, like Gmail, Slack, HubSpot, Google Drive and Notion, so agents can work where your data lives.",
  },
  {
    icon: ShieldCheck,
    title: "Human approval for sensitive actions",
    description:
      "Require sign-off before an agent sends an email, updates your CRM or changes important records.",
  },
  {
    icon: ScrollText,
    title: "Activity and audit history",
    description:
      "See every task an agent ran, which tools it used, how long it took and what it produced.",
  },
  {
    icon: Users,
    title: "Team workspaces",
    description:
      "Invite your team, control who can do what, and manage all your agents and usage in one place.",
  },
];

export function Features() {
  return (
    <section id="features" className="scroll-mt-16 border-t border-border py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Features"
          title="Built for real business operations"
          description="Everything a growing company needs to put AI agents to work without losing control."
        />

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group rounded-card border border-border bg-surface p-7 transition-colors hover:bg-surface-raised"
            >
              <div className="mb-5 flex size-12 items-center justify-center rounded-control border border-border bg-surface-raised text-accent transition-transform group-hover:scale-105">
                <feature.icon aria-hidden="true" className="size-6" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-foreground">{feature.title}</h3>
              <p className="text-sm leading-relaxed text-muted">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
