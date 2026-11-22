import type { AgentStatus, ExecutionStatus, WorkflowStatus } from "@/types";
import { Badge, type BadgeTone } from "./badge";

type Status = AgentStatus | WorkflowStatus | ExecutionStatus;

const statusStyles: Record<Status, { label: string; tone: BadgeTone }> = {
  active: { label: "Active", tone: "success" },
  succeeded: { label: "Succeeded", tone: "success" },
  paused: { label: "Paused", tone: "warning" },
  queued: { label: "Queued", tone: "warning" },
  draft: { label: "Draft", tone: "neutral" },
  error: { label: "Error", tone: "danger" },
  failed: { label: "Failed", tone: "danger" },
  running: { label: "Running", tone: "info" },
};

/** Colored badge for agent, workflow and execution statuses. Always shows text, not color alone. */
export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  const { label, tone } = statusStyles[status];
  return (
    <Badge tone={tone} className={className}>
      {label}
    </Badge>
  );
}
