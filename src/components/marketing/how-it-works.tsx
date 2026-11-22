import { SectionHeading } from "./section-heading";

const steps = [
  {
    title: "Create your workspace",
    description:
      "Set up a private workspace for your business, invite your team and connect the tools you use every day.",
  },
  {
    title: "Configure your agents",
    description:
      "Give each agent a job, clear instructions and only the tools and data it's allowed to use.",
  },
  {
    title: "Automate and review",
    description:
      "Run agents on demand or as part of workflows, follow their progress on your dashboard and approve sensitive actions.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-16 border-t border-border py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="How it works"
          title="From setup to automation in three steps"
          description="No AI infrastructure to build. Just describe the work and review the results."
        />

        <ol className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step.title} className="rounded-card border border-border bg-surface p-8">
              <span aria-hidden="true" className="mb-4 block text-4xl font-extrabold text-border-strong">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="mb-3 text-xl font-bold text-foreground">
                <span className="sr-only">Step {index + 1}: </span>
                {step.title}
              </h3>
              <p className="text-sm leading-relaxed text-muted">{step.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
