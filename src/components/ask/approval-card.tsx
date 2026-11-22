"use client";

import { CircleCheck, CircleX, Mail } from "lucide-react";
import { useId, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ChatItem } from "@/types/chat";

type ApprovalItem = Extract<ChatItem, { type: "approval" }>;

type ApprovalCardProps = {
  item: ApprovalItem;
  onChange: (patch: Partial<ApprovalItem>) => void;
};

/** "Baba wants to send an email" — needs Approve, Edit or Reject. */
export function ApprovalCard({ item, onChange }: ApprovalCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.body);
  const bodyId = useId();
  const editId = useId();

  const accent =
    item.status === "approved" ? "bg-success" : item.status === "rejected" ? "bg-subtle" : "bg-warning";

  function approve() {
    // Phase 1: nothing is actually sent. Phase 2 will send through the connected integration.
    onChange({
      status: "approved",
      resultText: "Approved. Email sending isn't connected yet, so nothing was sent.",
    });
  }

  function reject() {
    onChange({ status: "rejected", resultText: "Rejected — nothing was sent." });
  }

  function startEditing() {
    setDraft(item.body);
    setEditing(true);
  }

  function saveEdit() {
    onChange({ body: draft });
    setEditing(false);
  }

  return (
    <section
      aria-label="Approval request: send an email"
      className="relative overflow-hidden rounded-card border border-border bg-surface-raised p-4"
    >
      <div aria-hidden="true" className={cn("absolute inset-y-0 left-0 w-1", accent)} />
      <div className="flex flex-col gap-4 pl-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Mail aria-hidden="true" className="size-5 text-warning" />
            <h3 className="text-sm font-semibold text-foreground">Baba wants to send an email</h3>
          </div>
          {item.status === "pending" && <Badge tone="warning">Needs your approval</Badge>}
          {item.status === "approved" && <Badge tone="success">Approved</Badge>}
          {item.status === "rejected" && <Badge tone="neutral">Rejected</Badge>}
        </div>

        <dl className="grid grid-cols-[4.5rem_1fr] gap-x-2 gap-y-1 text-sm">
          <dt className="text-muted">To:</dt>
          <dd className="min-w-0 break-words font-medium text-foreground">{item.to}</dd>
          <dt className="text-muted">Subject:</dt>
          <dd className="min-w-0 font-medium text-foreground">{item.subject}</dd>
        </dl>

        {editing ? (
          <div className="flex flex-col gap-2">
            <label htmlFor={editId} className="text-xs font-semibold text-muted">
              Email text
            </label>
            <textarea
              id={editId}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={8}
              className="w-full rounded-control border border-border bg-surface p-3 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={saveEdit}>
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-control border border-border bg-surface p-3">
            <div className="relative">
              <p
                id={bodyId}
                className={cn("whitespace-pre-line text-sm text-muted", !expanded && "max-h-24 overflow-hidden")}
              >
                {item.body}
              </p>
              {!expanded && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-surface to-transparent"
                />
              )}
            </div>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              aria-controls={bodyId}
              className="mt-2 text-xs font-medium text-accent hover:underline"
            >
              {expanded ? "Show less" : "Show full email"}
            </button>
          </div>
        )}

        {item.status === "pending" && !editing && (
          <div className="flex flex-wrap gap-2">
            <Button onClick={approve}>Approve and send</Button>
            <Button variant="secondary" onClick={startEditing}>
              Edit
            </Button>
            <Button variant="ghost" onClick={reject}>
              Reject
            </Button>
          </div>
        )}

        {item.status !== "pending" && item.resultText && (
          <p
            role="status"
            className={cn(
              "flex items-center gap-2 text-sm font-medium",
              item.status === "approved" ? "text-success" : "text-muted",
            )}
          >
            {item.status === "approved" ? (
              <CircleCheck aria-hidden="true" className="size-4" />
            ) : (
              <CircleX aria-hidden="true" className="size-4" />
            )}
            {item.resultText}
          </p>
        )}
      </div>
    </section>
  );
}
