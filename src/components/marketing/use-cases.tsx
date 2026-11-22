import { Briefcase, CircleCheck, Headphones, Megaphone, Search, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionHeading } from "./section-heading";

const useCases = [
  {
    icon: Target,
    title: "Sales and lead generation",
    tasks: [
      "Research and enrich new leads automatically",
      "Draft personalized follow-up emails for approval",
      "Keep your CRM records and deal stages up to date",
    ],
  },
  {
    icon: Headphones,
    title: "Customer support",
    tasks: [
      "Classify and prioritize incoming support tickets",
      "Draft replies using your help center content",
      "Escalate urgent or sensitive cases to a person",
    ],
  },
  {
    icon: Briefcase,
    title: "Business operations",
    tasks: [
      "Extract line items from invoices and receipts",
      "Track contract renewal dates and obligations",
      "Compile weekly reports across departments",
    ],
  },
  {
    icon: Megaphone,
    title: "Marketing",
    tasks: [
      "Research competitor campaigns and positioning",
      "Draft campaign content for different audiences",
      "Summarize marketing performance with next steps",
    ],
  },
  {
    icon: Search,
    title: "Research and analysis",
    tasks: [
      "Research topics across the web and summarize findings",
      "Pull key information out of long documents",
      "Analyze spreadsheets and highlight business insights",
    ],
    wide: true,
  },
];

export function UseCases() {
  return (
    <section id="use-cases" className="scroll-mt-16 border-t border-border py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Use cases"
          title="Useful across every department"
          description="Hand repetitive, time-consuming work to agents built for each team."
        />

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {useCases.map((useCase) => (
            <div
              key={useCase.title}
              className={cn(
                "rounded-card border border-border bg-surface p-6",
                useCase.wide && "md:col-span-2 lg:col-span-2",
              )}
            >
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-lg border border-border bg-surface-raised p-2 text-accent">
                  <useCase.icon aria-hidden="true" className="size-5" />
                </div>
                <h3 className="text-base font-semibold text-foreground">{useCase.title}</h3>
              </div>
              <ul className={cn("gap-3 text-sm text-muted", useCase.wide ? "grid md:grid-cols-3" : "space-y-3")}>
                {useCase.tasks.map((task) => (
                  <li key={task} className="flex items-start gap-2.5">
                    <CircleCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-accent" />
                    <span>{task}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
