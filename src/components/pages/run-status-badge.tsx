import { Badge, type BadgeTone } from "@/components/ui/badge";
import type { TaskStatus as RunStatus } from "@/types/app-data";

const meta: Record<RunStatus, { label: string; tone: BadgeTone }> = {
  succeeded: { label: "Succeeded", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
  running: { label: "Running", tone: "info" },
  paused: { label: "Paused at cap", tone: "warning" },
  needs_approval: { label: "Needs approval", tone: "warning" },
};

/** Status of a task or workflow run, always with a text label. */
export function RunStatusBadge({ status }: { status: RunStatus }) {
  return <Badge tone={meta[status].tone}>{meta[status].label}</Badge>;
}
