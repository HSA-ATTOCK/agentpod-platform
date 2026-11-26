"use client";

import { Bot, Globe, Plus, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, inputClasses, selectClasses } from "@/components/ui/input";
import { LocalTime } from "@/components/ui/local-time";
import { Sheet } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { routes } from "@/config/routes";

export type CustomAgentRow = {
  id: string;
  name: string;
  description: string;
  instructions: string;
  model: string;
  webAccess: boolean;
  maxCostUsd: number;
  enabled: boolean;
  runs: number;
  lastRunAt: string | null;
  tools: string[];
};

/** Read-only connected tools a custom agent can be given (the server checks this list too). */
const TOOL_CHOICES = [
  ["knowledge_search", "Search your knowledge base"],
  ["memory_list", "Read business memory"],
  ["db_query", "Query connected databases (read-only)"],
  ["drive_search", "Search Google Drive"],
  ["drive_read", "Read Google Drive files"],
  ["gmail_search", "Search Gmail"],
  ["gmail_read", "Read emails"],
  ["calendar_list_events", "See calendar events"],
] as const;

const MODELS = [
  ["claude-sonnet-5-5", "Claude Sonnet 5.5 — best quality"],
  ["claude-haiku-5-5", "Claude Haiku 5.5 — fastest and cheapest"],
] as const;

const TEMPLATES = [
  {
    name: "Proposal Writer",
    description: "Writes client proposals in our format and tone.",
    instructions:
      "You write business proposals for our company.\n\nStructure: 1) Summary of the client's need, 2) Our proposed solution, 3) Scope and deliverables, 4) Timeline, 5) Pricing (only figures given in the task; otherwise write [PRICE TO CONFIRM]), 6) Next steps.\nTone: confident, friendly, no jargon. Keep it under 2 pages.\nSave the proposal as a DOCX file named after the client.",
    webAccess: false,
  },
  {
    name: "Competitor Watcher",
    description: "Checks competitors' websites and reports changes in pricing and offers.",
    instructions:
      "You research the competitors named in the task.\n\nFor each one: current prices and plans, new products or offers, notable website changes, and anything we should respond to. Use their official websites first. Give a source link for every fact and the date checked. End with 3 recommended actions for us.",
    webAccess: true,
  },
  {
    name: "Inventory Analyst",
    description: "Analyses stock data and recommends what to reorder.",
    instructions:
      "You analyse inventory data provided in the task (CSV or tables).\n\nCalculate stock cover in days from average daily sales, flag items below 14 days of cover, flag slow movers (no sales in 60 days), and produce a reorder list with suggested quantities for 30 days of cover. Show your calculations. Save the reorder list as an XLSX file.",
    webAccess: false,
  },
];

type Draft = { id?: string; name: string; description: string; instructions: string; model: string; webAccess: boolean; maxCostUsd: string; enabled: boolean; tools: string[] };
const empty: Draft = { name: "", description: "", instructions: "", model: "claude-sonnet-5-5", webAccess: false, maxCostUsd: "0.50", enabled: true, tools: [] };

async function call(method: string, body: unknown) {
  const res = await fetch("/api/custom-agents", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? "That didn't work.");
}

/** "Your own agents": create specialists with their own instructions, model, web access and cost limit. */
export function CustomAgents({ agents, canEdit, extraModels = [] }: { agents: CustomAgentRow[]; canEdit: boolean; extraModels?: { value: string; label: string }[] }) {
  const router = useRouter();
  const { toast, showToast } = useToast();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setBusy("save");
    setError(null);
    try {
      await call("POST", { ...draft, maxCostUsd: Number(draft.maxCostUsd) });
      showToast(draft.id ? "Agent updated (new version)." : "Agent created. Ask Baba to use it.");
      setDraft(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setBusy(null);
    }
  }

  async function toggle(agent: CustomAgentRow, enabled: boolean) {
    setBusy(agent.id);
    try {
      await call("POST", { ...agent, enabled });
      showToast(enabled ? `${agent.name} is on.` : `${agent.name} is off.`);
      router.refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't update.");
    } finally {
      setBusy(null);
    }
  }

  async function remove(agent: { id: string; name: string }) {
    if (!window.confirm(`Delete ${agent.name}? Baba won't be able to use it any more.`)) return;
    setBusy(agent.id);
    try {
      await call("DELETE", { id: agent.id });
      showToast("Agent deleted.");
      setDraft(null);
      router.refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't delete.");
    } finally {
      setBusy(null);
    }
  }

  const open = (agent?: CustomAgentRow) => {
    setError(null);
    setDraft(agent ? { ...agent, maxCostUsd: agent.maxCostUsd.toFixed(2) } : { ...empty });
  };

  return (
    <section className="space-y-4">
      {toast}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Sparkles aria-hidden="true" className="size-4 text-accent" /> Your own agents
          </h2>
          <p className="text-sm text-muted">
            Create specialists for your business with their own instructions. Baba hands them work when a task fits, each in its own workspace with its own cost limit.
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => open()}>
            <Plus aria-hidden="true" className="size-4" /> New agent
          </Button>
        )}
      </div>

      {agents.length === 0 ? (
        <Card className="space-y-3 p-5">
          <p className="text-sm text-muted">No custom agents yet. {canEdit ? "Start from a template:" : "Owners and admins can create them."}</p>
          {canEdit && (
            <div className="grid gap-3 md:grid-cols-3">
              {TEMPLATES.map((t) => (
                <button
                  key={t.name}
                  type="button"
                  onClick={() => setDraft({ ...empty, ...t })}
                  className="rounded-control border border-border bg-surface-raised p-3 text-left transition-colors hover:border-accent/40"
                >
                  <p className="text-sm font-medium text-foreground">{t.name}</p>
                  <p className="mt-1 text-xs text-muted">{t.description}</p>
                </button>
              ))}
            </div>
          )}
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {agents.map((a) => (
            <Card key={a.id} className="flex flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-control border border-accent/20 bg-accent/10 text-accent">
                    <Bot aria-hidden="true" className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{a.name}</p>
                    <p className="text-xs text-muted">{a.description || "No description"}</p>
                  </div>
                </div>
                {canEdit && <Switch checked={a.enabled} disabled={busy === a.id} label={`${a.enabled ? "Turn off" : "Turn on"} ${a.name}`} onChange={(v) => void toggle(a, v)} />}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Badge>{a.model === "claude-haiku-5-5" ? "Haiku" : a.model.startsWith("ext:") ? (extraModels.find((m) => m.value === a.model)?.label ?? "Other model") : "Sonnet"}</Badge>
                {a.webAccess && (
                  <Badge tone="info">
                    <Globe aria-hidden="true" className="mr-1 size-3" /> Web
                  </Badge>
                )}
                <Badge>Up to ${a.maxCostUsd.toFixed(2)} a run</Badge>
                {a.tools.length > 0 && <Badge tone="accent">{a.tools.length} connected tool{a.tools.length === 1 ? "" : "s"}</Badge>}
                {!a.enabled && <Badge tone="neutral">Off</Badge>}
              </div>
              <p className="text-xs text-subtle">
                {a.runs} run{a.runs === 1 ? "" : "s"}
                {a.lastRunAt && (
                  <>
                    {" "}
                    · last <LocalTime iso={a.lastRunAt} format="relative" />
                  </>
                )}
              </p>
              <div className="mt-auto flex flex-wrap gap-2">
                <ButtonLink size="sm" href={`${routes.ask}?prompt=${encodeURIComponent(`Use my ${a.name} agent to `)}`}>
                  Use in Ask Baba
                </ButtonLink>
                {canEdit && (
                  <Button size="sm" variant="secondary" onClick={() => open(a)}>
                    Edit
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Sheet open={draft !== null} onClose={() => setDraft(null)} side="right" title={draft?.id ? `Edit ${draft.name}` : "New agent"}>
        {draft && (
          <form onSubmit={save} className="space-y-4 p-4">
            {error && <Alert variant="error">{error}</Alert>}
            <Input id="ca-name" label="Name" placeholder="e.g. Proposal Writer" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            <Input id="ca-desc" label="What it's for (Baba reads this to decide when to use it)" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-foreground">Instructions</span>
              <textarea
                rows={10}
                className={inputClasses}
                value={draft.instructions}
                onChange={(e) => setDraft({ ...draft, instructions: e.target.value })}
                placeholder="What it does, step by step; the format of its result; tone; what it must never do."
              />
              <span className="block text-[11px] text-subtle">Baba&apos;s safety rules always apply on top: no invented facts, no access to your email or accounts, approvals for anything sensitive.</span>
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-foreground">Model</span>
              <select className={selectClasses} value={draft.model} onChange={(e) => setDraft({ ...draft, model: e.target.value })}>
                {MODELS.map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
                {extraModels.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              {draft.model.startsWith("ext:") && (
                <span className="block text-[11px] text-subtle">Other providers can use the connected tools below but not the web or a file workspace.</span>
              )}
            </label>
            <Input id="ca-cost" label="Cost limit per run (USD, max $10)" inputMode="decimal" value={draft.maxCostUsd} onChange={(e) => setDraft({ ...draft, maxCostUsd: e.target.value })} />
            <label className={`flex items-center gap-2 text-sm text-foreground ${draft.model.startsWith("ext:") ? "opacity-50" : ""}`}>
              <input type="checkbox" disabled={draft.model.startsWith("ext:")} checked={draft.webAccess && !draft.model.startsWith("ext:")} onChange={(e) => setDraft({ ...draft, webAccess: e.target.checked })} />
              Can search and read the web
            </label>
            <fieldset className="space-y-2 rounded-control border border-border p-3">
              <legend className="px-1 text-sm font-medium text-foreground">Connected tools (read-only)</legend>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {TOOL_CHOICES.map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-sm text-muted">
                    <input
                      type="checkbox"
                      checked={draft.tools.includes(key)}
                      onChange={(e) => setDraft({ ...draft, tools: e.target.checked ? [...draft.tools, key] : draft.tools.filter((t) => t !== key) })}
                    />
                    {label}
                  </label>
                ))}
              </div>
              <p className="text-[11px] text-subtle">Custom agents can read but never send, change or delete anything.</p>
            </fieldset>
            <div className="flex flex-wrap justify-between gap-2 border-t border-border pt-4">
              {draft.id ? (
                <Button variant="ghost" className="text-danger" loading={busy === draft.id} onClick={() => void remove({ id: draft.id!, name: draft.name })}>
                  Delete
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setDraft(null)}>
                  Cancel
                </Button>
                <Button type="submit" loading={busy === "save"} loadingText="Saving…">
                  {draft.id ? "Save new version" : "Create agent"}
                </Button>
              </div>
            </div>
          </form>
        )}
      </Sheet>
    </section>
  );
}
