import { Lock, SlidersHorizontal, UserCheck } from "lucide-react";

const points = [
  {
    icon: Lock,
    title: "A private workspace for every business",
    description:
      "Your agents, workflows, documents and history live in your own workspace. Other businesses can never see them.",
  },
  {
    icon: UserCheck,
    title: "Sensitive actions need approval",
    description:
      "Decide which actions need a human checkpoint, like sending emails or changing records, before an agent can go ahead.",
  },
  {
    icon: SlidersHorizontal,
    title: "You choose the tools",
    description:
      "Agents can only use the integrations and data you turn on for them, and you can change that at any time.",
  },
];

export function Trust() {
  return (
    <section className="border-t border-border bg-surface py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-accent">Security and control</p>
          <h2 className="text-2xl font-bold text-foreground sm:text-3xl">You stay in control of your agents</h2>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {points.map((point) => (
            <div key={point.title} className="rounded-card border border-border bg-surface-raised p-6">
              <div className="mb-4 flex size-10 items-center justify-center rounded-lg border border-border bg-background text-accent">
                <point.icon aria-hidden="true" className="size-5" />
              </div>
              <h3 className="mb-2 text-base font-semibold text-foreground">{point.title}</h3>
              <p className="text-sm leading-relaxed text-muted">{point.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
