import {
  ChevronRight,
  FileCheck,
  FileText,
  Funnel,
  Search,
  Send,
  ShieldAlert,
  Sparkles,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const previewAgents: {
  name: string;
  detail: string;
  icon: LucideIcon;
  iconClass: string;
  status: string;
  tone: BadgeTone;
}[] = [
  { name: "Lead Research Agent", detail: "Sales · Researching leads", icon: Sparkles, iconClass: "text-accent", status: "Active", tone: "success" },
  { name: "Lead Scoring Agent", detail: "CRM · Qualifying leads", icon: FileCheck, iconClass: "text-info", status: "Active", tone: "success" },
  { name: "Follow-up Email Agent", detail: "Email · Requires approval", icon: Send, iconClass: "text-warning", status: "Awaiting review", tone: "warning" },
];

type StepState = "done" | "in-progress" | "approval" | "pending";

const workflowSteps: { label: string; icon: LucideIcon; state: StepState }[] = [
  { label: "New lead", icon: UserPlus, state: "done" },
  { label: "Research", icon: Search, state: "done" },
  { label: "Qualify", icon: Funnel, state: "done" },
  { label: "Draft follow-up", icon: FileText, state: "in-progress" },
  { label: "Approve", icon: ShieldAlert, state: "approval" },
  { label: "Send", icon: Send, state: "pending" },
];

const stepStyles: Record<StepState, { box: string; icon: string }> = {
  done: { box: "border-success/40 bg-surface-raised text-foreground", icon: "text-success" },
  "in-progress": { box: "border-warning/40 bg-surface-raised text-foreground", icon: "text-warning" },
  approval: { box: "border-accent/60 bg-surface-raised font-semibold text-accent", icon: "text-accent" },
  pending: { box: "border-border bg-surface text-subtle", icon: "text-subtle" },
};

/** Illustrative app mock-up on the landing page (built in HTML, not an image). */
export function ProductPreview() {
  return (
    <div
      role="img"
      aria-label="Preview of an AgentPod workspace showing three agents and a lead follow-up workflow waiting for approval"
      className="relative rounded-card border border-border bg-surface p-4 shadow-2xl shadow-accent/5 sm:p-6"
    >
      <div aria-hidden="true">
        {/* Window chrome */}
        <div className="mb-4 flex items-center justify-between border-b border-border pb-4">
          <div className="flex min-w-0 items-center gap-2">
            <span className="size-3 rounded-full bg-border" />
            <span className="size-3 rounded-full bg-border" />
            <span className="size-3 rounded-full bg-border" />
            <span className="ml-2 truncate font-mono text-xs text-subtle">Acme Corp / workspace</span>
          </div>
          <div className="flex shrink-0 items-center gap-2 text-xs text-muted">
            <span className="size-2 rounded-full bg-success" /> Running
          </div>
        </div>

        {/* Agents */}
        <div className="mb-5">
          <div className="mb-2.5 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted">
            <span>Assigned agents</span>
            <span className="text-[11px] font-normal normal-case tracking-normal text-subtle">2 active</span>
          </div>
          <div className="space-y-2">
            {previewAgents.map((agent) => (
              <div
                key={agent.name}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-raised p-2.5"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className={cn("flex size-7 shrink-0 items-center justify-center rounded bg-border", agent.iconClass)}>
                    <agent.icon className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium text-foreground">{agent.name}</div>
                    <div className="truncate text-[11px] text-subtle">{agent.detail}</div>
                  </div>
                </div>
                <Badge tone={agent.tone} className="rounded px-2 text-[11px]">
                  {agent.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>

        {/* Workflow chain */}
        <div>
          <div className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted">
            Workflow: Inbound lead follow-up
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-background p-3 text-xs">
            {workflowSteps.map((step, index) => (
              <div key={step.label} className="flex items-center gap-2">
                <div className={cn("flex items-center gap-1.5 rounded-md border px-2.5 py-1.5", stepStyles[step.state].box)}>
                  <step.icon className={cn("size-3.5", stepStyles[step.state].icon)} />
                  <span>{step.label}</span>
                </div>
                {index < workflowSteps.length - 1 && <ChevronRight className="size-3.5 text-border-strong" />}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
