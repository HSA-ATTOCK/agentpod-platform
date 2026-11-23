"use client";

import { MessageSquare } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { PageHeader } from "@/components/ui/page-header";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { routes } from "@/config/routes";
import { mainAgent, specialists, type TeamMember } from "@/config/team";
import { formatCents } from "@/lib/format";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { ModelInfo } from "@/types/app-data";

type Filter = "all" | "active" | "coming_soon";

export type AgentUsage = Record<string, { tasks: number; costCents: number }>;

const MAX_CONTEXT = 4000;

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-subtle">{label}</span>
      <span className={cn("font-medium", accent ? "text-accent" : "text-foreground")}>{value}</span>
    </div>
  );
}

function AgentCard({ agent, model, tasks }: { agent: TeamMember; model: string; tasks: number }) {
  const active = agent.status === "active";
  return (
    <Card className={cn("flex h-full flex-col justify-between p-5", active ? "transition-colors hover:border-border-strong" : "opacity-70")}>
      <div>
        <div className="flex items-start justify-between">
          <span
            className={cn(
              "flex size-10 items-center justify-center rounded-control border border-border bg-surface-raised",
              active ? "text-accent" : "text-subtle",
            )}
          >
            <agent.icon aria-hidden="true" className="size-5" />
          </span>
          {active ? <Badge tone="success">Active</Badge> : <Badge tone="neutral">Coming soon</Badge>}
        </div>
        <h3 className="mt-3 font-medium text-foreground">{agent.name}</h3>
        <p className="mt-1 text-xs text-muted">{agent.job}</p>
      </div>
      {active && (
        <div className="mt-5 space-y-2.5 border-t border-border pt-4">
          <Stat label="Model" value={model} />
          <Stat label="Tools" value={agent.tools.join(", ")} />
          <Stat label="Tasks this month" value={tasks} />
          <div className="pt-1 text-right">
            <Link href={`${routes.activity}?agent=${encodeURIComponent(agent.name)}`} className="py-1 text-xs font-medium text-accent hover:underline">
              View activity
            </Link>
          </div>
        </div>
      )}
    </Card>
  );
}

type AgentsViewProps = {
  model: ModelInfo;
  usage: AgentUsage;
  workspaceId: string;
  businessContext: string;
  canEdit: boolean;
};

export function AgentsView({ model, usage, workspaceId, businessContext, canEdit }: AgentsViewProps) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(businessContext);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast, showToast } = useToast();

  const active = specialists.filter((a) => a.status === "active");
  const soon = specialists.filter((a) => a.status === "coming_soon");
  const shown = filter === "all" ? specialists : filter === "active" ? active : soon;
  const baba = usage[mainAgent.name] ?? { tasks: 0, costCents: 0 };

  async function save() {
    setSaving(true);
    setError(null);
    const { error: saveError } = await getSupabaseBrowser()
      .from("workspaces")
      .update({ business_context: draft.trim() })
      .eq("id", workspaceId);
    setSaving(false);
    if (saveError) {
      setError("Couldn't save. Only owners and admins can change these instructions.");
      return;
    }
    setEditing(false);
    showToast("Saved. Baba will use this in your next new conversation.");
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <PageHeader title="AI Agents" description="Baba and its team of specialists. Baba decides who works on each task." />

      {/* Main agent */}
      <Card className="relative overflow-hidden border-accent/40 p-5 shadow-lg shadow-accent/5 sm:p-6">
        <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-12 size-48 rounded-full bg-accent/5 blur-2xl" />
        <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div className="flex items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-accent/30 bg-accent/15 text-accent">
              <mainAgent.icon aria-hidden="true" className="size-6" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-foreground">Baba — Main agent</h2>
                <Badge tone="success">Active</Badge>
                <Badge tone="neutral">{model.label}</Badge>
                {model.testMode && <Badge tone="warning">Test mode</Badge>}
              </div>
              <p className="mt-1.5 max-w-2xl text-sm text-muted">{mainAgent.description}</p>
              <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs">
                <div className="flex gap-1.5">
                  <dt className="text-subtle">Tasks this month:</dt>
                  <dd className="font-semibold text-foreground">{baba.tasks}</dd>
                </div>
                <div className="flex gap-1.5">
                  <dt className="text-subtle">Average cost per task:</dt>
                  <dd className="font-semibold text-accent">{baba.tasks ? formatCents(Math.round(baba.costCents / baba.tasks)) : "—"}</dd>
                </div>
              </dl>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button variant="secondary" onClick={() => { setDraft(businessContext); setError(null); setEditing(true); }}>
              {canEdit ? "Business instructions" : "View instructions"}
            </Button>
            <ButtonLink href={routes.ask}>
              <MessageSquare aria-hidden="true" className="size-4" />
              Ask Baba
            </ButtonLink>
          </div>
        </div>
        {businessContext ? (
          <p className="relative mt-5 line-clamp-2 border-t border-border pt-4 text-xs text-muted">
            <span className="font-semibold text-foreground">About your business: </span>
            {businessContext}
          </p>
        ) : (
          canEdit && (
            <p className="relative mt-5 border-t border-border pt-4 text-xs text-subtle">
              Tip: tell Baba about your business (what you sell, who your customers are, your tone of voice) so every
              answer fits you better.
            </p>
          )
        )}
      </Card>

      {/* Specialists */}
      <section aria-labelledby="specialists-title" className="space-y-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <h2 id="specialists-title" className="text-lg font-semibold text-foreground">Specialists</h2>
            <p className="text-xs text-muted">Baba hands larger parts of a task to the right specialist and checks their work.</p>
          </div>
          <FilterTabs
            label="Filter specialists"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: `All (${specialists.length})` },
              { value: "active", label: `Active (${active.length})` },
              { value: "coming_soon", label: `Coming soon (${soon.length})` },
            ]}
          />
        </div>
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {shown.map((agent) => (
            <li key={agent.id}>
              <AgentCard agent={agent} model={model.label} tasks={usage[agent.name]?.tasks ?? 0} />
            </li>
          ))}
        </ul>
      </section>

      <Sheet
        open={editing}
        onClose={() => setEditing(false)}
        side="wide-right"
        title="Business instructions"
        footer={
          canEdit ? (
            <>
              <Button variant="secondary" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button onClick={save} loading={saving} loadingText="Saving…" disabled={draft.length > MAX_CONTEXT}>
                Save instructions
              </Button>
            </>
          ) : undefined
        }
      >
        <div className="space-y-4 p-4">
          <p className="text-sm text-muted">
            Baba reads this at the start of every new conversation, so its research, writing and advice fit your
            business. Include what you do, your customers, your location, and how you like things written.
          </p>
          {error && <Alert variant="error">{error}</Alert>}
          <div>
            <label htmlFor="business-context" className="mb-1.5 block text-xs font-semibold text-muted">
              About your business
            </label>
            <textarea
              id="business-context"
              rows={12}
              value={draft}
              readOnly={!canEdit}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="e.g. We're a family bakery in Manchester selling sourdough and cakes online across the UK. Our customers are mostly 25–45. Write in a warm, plain-English tone and use British spelling."
              className="w-full rounded-control border border-border bg-surface-raised p-3 text-sm leading-relaxed text-foreground placeholder:text-subtle focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <p className={cn("mt-1 text-right text-[11px]", draft.length > MAX_CONTEXT ? "text-danger" : "text-subtle")}>
              {draft.length} / {MAX_CONTEXT}
            </p>
          </div>
          {!canEdit && <p className="text-xs text-subtle">Only owners and admins can change these instructions.</p>}
          <p className="text-xs text-subtle">
            The agents&apos; own skills (how they research, write and check work) are built in and kept up to date for
            you.
          </p>
        </div>
      </Sheet>
      {toast}
    </div>
  );
}
