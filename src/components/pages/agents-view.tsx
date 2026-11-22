"use client";

import { MessageSquare } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ActionMenu } from "@/components/ui/action-menu";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { selectClasses } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Sheet } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { routes } from "@/config/routes";
import { sampleMainAgent, sampleTeam, type TeamAgent } from "@/lib/sample-pages";
import { cn } from "@/lib/utils";

type Filter = "all" | "active" | "coming_soon";
type Editing = { name: string; instructions: string; model: string };

const MODELS = ["Claude Sonnet 5.5", "Claude Opus 5.5", "Claude Haiku 5.5"];
const TOOLS = ["Web search", "Read web pages", "Run code", "Create files"];

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-subtle">{label}</span>
      <span className={cn("font-medium", accent ? "text-accent" : "text-foreground")}>{value}</span>
    </div>
  );
}

function AgentCard({ agent, onEdit, onPause }: { agent: TeamAgent; onEdit: () => void; onPause: () => void }) {
  const router = useRouter();
  const active = agent.status === "active";
  return (
    <Card className={cn("flex flex-col justify-between p-5", active ? "transition-colors hover:border-border-strong" : "opacity-70")}>
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
          {active ? (
            <ActionMenu
              label={`${agent.name} options`}
              actions={[
                { label: "Edit instructions", onSelect: onEdit },
                { label: "View activity", onSelect: () => router.push(routes.activity) },
                { label: "Pause", onSelect: onPause, danger: true },
              ]}
            />
          ) : (
            <Badge tone="neutral">Coming soon</Badge>
          )}
        </div>
        <h3 className="mt-3 font-medium text-foreground">{agent.name}</h3>
        <p className="mt-1 text-xs text-muted">{agent.job}</p>
      </div>
      {active && (
        <div className="mt-5 space-y-2.5 border-t border-border pt-4">
          <Stat label="Model" value={agent.model} />
          <Stat label="Tasks this month" value={agent.tasksThisMonth ?? 0} />
          <div className="flex items-center justify-between pt-1">
            <Badge tone="success">Active</Badge>
            <button type="button" onClick={onEdit} className="py-1 text-xs font-medium text-accent hover:underline">
              Edit instructions
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

export function AgentsView() {
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<Editing | null>(null);
  const [tools, setTools] = useState<Record<string, boolean>>(Object.fromEntries(TOOLS.map((t) => [t, true])));
  const { toast, showToast } = useToast();

  const active = sampleTeam.filter((a) => a.status === "active");
  const soon = sampleTeam.filter((a) => a.status === "coming_soon");
  const shown = filter === "all" ? sampleTeam : filter === "active" ? active : soon;

  function openEditor(agent: { name: string; instructions?: string; model: string }) {
    setTools(Object.fromEntries(TOOLS.map((t) => [t, true])));
    setEditing({ name: agent.name, instructions: agent.instructions ?? "", model: agent.model });
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="AI Agents"
        description="Baba and its team of specialists. Baba decides who works on each task."
        sample
      />

      {/* Main agent */}
      <Card className="relative overflow-hidden border-accent/40 p-5 shadow-lg shadow-accent/5 sm:p-6">
        <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-12 size-48 rounded-full bg-accent/5 blur-2xl" />
        <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div className="flex items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-accent/30 bg-accent/15 text-accent">
              <sampleMainAgent.icon aria-hidden="true" className="size-6" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-foreground">Baba — Main agent</h2>
                <Badge tone="success">Active</Badge>
                <Badge tone="neutral">{sampleMainAgent.model}</Badge>
              </div>
              <p className="mt-1.5 max-w-2xl text-sm text-muted">{sampleMainAgent.description}</p>
              <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs">
                <div className="flex gap-1.5">
                  <dt className="text-subtle">Tasks this month:</dt>
                  <dd className="font-semibold text-foreground">{sampleMainAgent.tasksThisMonth}</dd>
                </div>
                <div className="flex gap-1.5">
                  <dt className="text-subtle">Average cost per task:</dt>
                  <dd className="font-semibold text-accent">{sampleMainAgent.averageCost}</dd>
                </div>
              </dl>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button variant="secondary" onClick={() => openEditor(sampleMainAgent)}>
              Edit instructions
            </Button>
            <ButtonLink href={routes.ask}>
              <MessageSquare aria-hidden="true" className="size-4" />
              Ask Baba
            </ButtonLink>
          </div>
        </div>
      </Card>

      {/* Specialists */}
      <section aria-labelledby="specialists-title" className="space-y-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <h2 id="specialists-title" className="text-lg font-semibold text-foreground">Specialists</h2>
            <p className="text-xs text-muted">Baba hands each part of a task to the right specialist.</p>
          </div>
          <FilterTabs
            label="Filter specialists"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: `All (${sampleTeam.length})` },
              { value: "active", label: `Active (${active.length})` },
              { value: "coming_soon", label: `Coming soon (${soon.length})` },
            ]}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {shown.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onEdit={() => openEditor(agent)}
              onPause={() => showToast("Pausing specialists isn't available yet.")}
            />
          ))}
        </div>
      </section>

      <Sheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        side="wide-right"
        title={editing ? `Edit ${editing.name}` : "Edit agent"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setEditing(null);
                showToast("Changes saved (sample — not connected yet).");
              }}
            >
              Save changes
            </Button>
          </>
        }
      >
        {editing && (
          <div className="space-y-5 p-4">
            <div>
              <label htmlFor="agent-instructions" className="mb-1.5 block text-xs font-semibold text-muted">
                Instructions
              </label>
              <textarea
                id="agent-instructions"
                rows={7}
                value={editing.instructions}
                onChange={(e) => setEditing({ ...editing, instructions: e.target.value })}
                className="w-full rounded-control border border-border bg-surface-raised p-3 text-sm leading-relaxed text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
            <div>
              <label htmlFor="agent-model" className="mb-1.5 block text-xs font-semibold text-muted">
                Model
              </label>
              <select
                id="agent-model"
                value={editing.model}
                onChange={(e) => setEditing({ ...editing, model: e.target.value })}
                className={selectClasses}
              >
                {MODELS.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-subtle">Opus: best quality, higher cost. Haiku: cheapest, for simple work.</p>
            </div>
            <fieldset>
              <legend className="mb-2 text-xs font-semibold text-muted">Tools</legend>
              <ul className="space-y-2">
                {TOOLS.map((tool) => (
                  <li key={tool} className="flex items-center justify-between rounded-control border border-border bg-surface-raised px-3 py-2.5 text-sm text-foreground">
                    {tool}
                    <Switch checked={tools[tool]} onChange={(v) => setTools({ ...tools, [tool]: v })} label={tool} />
                  </li>
                ))}
              </ul>
            </fieldset>
          </div>
        )}
      </Sheet>
      {toast}
    </div>
  );
}
