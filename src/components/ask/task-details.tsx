import { ClipboardList, Download } from "lucide-react";
import type { ReactNode } from "react";
import { fileKindMeta, getTaskDetails, toolMeta } from "@/lib/chat-meta";
import type { Conversation } from "@/types/chat";
import { StepStatusIcon } from "./step-status-icon";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-subtle">{title}</h3>
      {children}
    </section>
  );
}

/** What Baba is doing for the current task: plan, files, sources, tools. */
export function TaskDetails({ conversation }: { conversation: Conversation | null }) {
  const { steps, files, sources, tools } = getTaskDetails(conversation);
  const isEmpty = steps.length + files.length + sources.length + tools.length === 0;

  if (isEmpty) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center">
        <div className="mb-4 flex size-12 items-center justify-center rounded-xl border border-border bg-surface-raised text-subtle">
          <ClipboardList aria-hidden="true" className="size-6" />
        </div>
        <p className="mb-1 text-sm font-semibold text-foreground">Ready when you are</p>
        <p className="text-xs text-muted">
          Once you start a task, Baba&apos;s plan, the tools it uses and any approvals will appear here.
        </p>
      </div>
    );
  }

  const done = steps.filter((s) => s.status === "done").length;

  return (
    <div className="space-y-6 p-4">
      {steps.length > 0 && (
        <Section title={`Plan (${done}/${steps.length})`}>
          <ol className="space-y-2.5">
            {steps.map((step) => (
              <li key={step.id} className="flex items-start gap-2.5 text-sm">
                <span className="mt-0.5 flex">
                  <StepStatusIcon status={step.status} size="sm" />
                </span>
                <span className={step.status === "pending" ? "text-muted" : "text-foreground"}>
                  {step.label}
                  {step.agent && <span className="block text-[11px] text-subtle">{step.agent}</span>}
                </span>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {files.length > 0 && (
        <Section title="Files created">
          <ul className="space-y-2">
            {files.map((file) => {
              const meta = fileKindMeta[file.kind];
              return (
                <li key={file.id} className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface-raised p-2.5">
                  <span className="flex min-w-0 items-center gap-2">
                    <meta.icon aria-hidden="true" className="size-4 shrink-0 text-accent" />
                    <span className="truncate text-sm text-foreground">{file.name}</span>
                  </span>
                  <button
                    type="button"
                    disabled
                    aria-label={`Download ${file.name} (not available yet)`}
                    className="flex size-8 shrink-0 items-center justify-center rounded-lg text-subtle disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Download aria-hidden="true" className="size-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {sources.length > 0 && (
        <Section title="Sources used">
          <ul className="space-y-1.5">
            {sources.map((source) => (
              <li key={source.id} className="truncate rounded-lg border border-border bg-surface-raised px-2.5 py-2 text-sm text-foreground">
                {source.url.replace(/^https?:\/\//, "")}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {tools.length > 0 && (
        <Section title="Tools used">
          <ul className="flex flex-wrap gap-1.5">
            {tools.map((tool) => {
              const meta = toolMeta[tool];
              return (
                <li key={tool} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-raised px-2.5 py-1 text-xs text-muted">
                  <meta.icon aria-hidden="true" className="size-3.5" />
                  {meta.label}
                </li>
              );
            })}
          </ul>
        </Section>
      )}
    </div>
  );
}
