"use client";

import { CircleCheck, CircleX, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ChatItem } from "@/types/chat";

type ToolApprovalItem = Extract<ChatItem, { type: "tool_approval" }>;

type ToolApprovalCardProps = {
  item: ToolApprovalItem;
  /** Sends the decision to Claude. Throws if it fails. */
  onDecide: (allow: boolean) => Promise<void>;
};

/** Baba paused before an action and needs the user's OK. */
export function ToolApprovalCard({ item, onDecide }: ToolApprovalCardProps) {
  const [busy, setBusy] = useState<"allow" | "deny" | null>(null);
  const [error, setError] = useState<string>();

  async function decide(allow: boolean) {
    setBusy(allow ? "allow" : "deny");
    setError(undefined);
    try {
      await onDecide(allow);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send your answer. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  const accent = item.status === "approved" ? "bg-success" : item.status === "rejected" ? "bg-subtle" : "bg-warning";

  return (
    <section
      aria-label={`Approval request: ${item.toolName}`}
      className="relative overflow-hidden rounded-card border border-border bg-surface-raised p-4"
    >
      <div aria-hidden="true" className={cn("absolute inset-y-0 left-0 w-1", accent)} />
      <div className="flex flex-col gap-3 pl-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldAlert aria-hidden="true" className="size-5 text-warning" />
            <h3 className="text-sm font-semibold text-foreground">Baba needs your OK: {item.toolName}</h3>
          </div>
          {item.status === "pending" && <Badge tone="warning">Needs your approval</Badge>}
          {item.status === "approved" && <Badge tone="success">Approved</Badge>}
          {item.status === "rejected" && <Badge tone="neutral">Rejected</Badge>}
        </div>

        <div className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-control border border-border bg-surface p-3 text-sm leading-relaxed text-foreground">
          {item.summary}
        </div>

        {item.status === "pending" ? (
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => decide(true)} loading={busy === "allow"} disabled={busy !== null}>
              Approve
            </Button>
            <Button variant="ghost" onClick={() => decide(false)} loading={busy === "deny"} disabled={busy !== null}>
              Reject
            </Button>
          </div>
        ) : (
          <p role="status" className={cn("flex items-center gap-2 text-sm font-medium", item.status === "approved" ? "text-success" : "text-muted")}>
            {item.status === "approved" ? <CircleCheck aria-hidden="true" className="size-4" /> : <CircleX aria-hidden="true" className="size-4" />}
            {item.status === "approved" ? "Approved — Baba is continuing." : "Rejected — Baba won't do this."}
          </p>
        )}
        {error && <p role="alert" className="text-xs text-danger">{error}</p>}
      </div>
    </section>
  );
}
