"use client";

import { ChevronRight, CircleCheck, Coins, Download, FileText, History, ListChecks, MessageSquare, TriangleAlert } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button, ButtonLink, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { selectClasses } from "@/components/ui/input";
import { LocalTime } from "@/components/ui/local-time";
import { PageHeader } from "@/components/ui/page-header";
import { Sheet } from "@/components/ui/sheet";
import { routes } from "@/config/routes";
import { activeAgentNames } from "@/config/team";
import { formatBytes } from "@/lib/baba/client";
import { durationBetween, formatCents } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TaskRecord, TaskStatus, TaskStep } from "@/types/app-data";
import { RunStatusBadge } from "./run-status-badge";

const PAGE_SIZE = 10;
const DAY = 86_400_000;

type Range = "7d" | "30d" | "month" | "90d";

function inRange(iso: string, range: Range, now: number) {
  const t = new Date(iso).getTime();
  if (range === "7d") return t >= now - 7 * DAY;
  if (range === "30d") return t >= now - 30 * DAY;
  if (range === "90d") return t >= now - 90 * DAY;
  const start = new Date(now);
  return t >= new Date(start.getFullYear(), start.getMonth(), 1).getTime();
}

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("");
}

/** Baba always takes part; specialists are listed after it. */
function taskAgents(task: TaskRecord) {
  return ["Baba", ...task.agents.filter((a) => a !== "Baba")];
}

function AgentChips({ agents }: { agents: string[] }) {
  return (
    <ul className="flex" aria-label={`Agents: ${agents.join(", ")}`}>
      {agents.map((agent, i) => (
        <li
          key={agent}
          title={agent}
          className={cn(
            "flex size-7 items-center justify-center rounded-full border border-border-strong bg-surface-raised text-[10px] font-semibold text-foreground",
            i > 0 && "-ml-1.5",
          )}
        >
          {initials(agent)}
        </li>
      ))}
    </ul>
  );
}

function StatCard({ label, value, icon, tone }: { label: string; value: string; icon: ReactNode; tone?: string }) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-2 flex items-center justify-between text-xs text-subtle">
        {label}
        {icon}
      </div>
      <p className={cn("text-2xl font-bold sm:text-3xl", tone ?? "text-foreground")}>{value}</p>
    </Card>
  );
}

function stepDot(step: TaskStep, task: TaskRecord) {
  if (step.status === "done") return "bg-success";
  if (step.status === "failed") return "bg-danger";
  return task.status === "paused" ? "bg-warning" : "bg-info animate-pulse";
}

function askLink(task: TaskRecord) {
  return task.conversationId ? `${routes.ask}?c=${task.conversationId}` : routes.ask;
}

export function ActivityView({ tasks, now, initialAgent }: { tasks: TaskRecord[]; now: number; initialAgent?: string }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | TaskStatus>("all");
  const [agent, setAgent] = useState(initialAgent && activeAgentNames.includes(initialAgent) ? initialAgent : "all");
  const [range, setRange] = useState<Range>("month");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = tasks.find((t) => t.id === selectedId) ?? null;

  const inPeriod = tasks.filter((t) => inRange(t.startedAt, range, now));
  const q = query.trim().toLowerCase();
  const filtered = inPeriod.filter(
    (t) =>
      (!q || t.request.toLowerCase().includes(q)) &&
      (status === "all" || t.status === status) &&
      (agent === "all" || taskAgents(t).includes(agent)),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const visible = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const succeeded = inPeriod.filter((t) => t.status === "succeeded").length;
  const failed = inPeriod.filter((t) => t.status === "failed").length;
  const spend = inPeriod.reduce((sum, t) => sum + t.costCents, 0);
  const periodLabel = { "7d": "last 7 days", "30d": "last 30 days", month: "this month", "90d": "last 90 days" }[range];

  function resetPage<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPage(1);
    };
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Activity" description="Everything Baba and its specialists did, with the cost of each task." />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label={`Tasks ${periodLabel}`} value={String(inPeriod.length)} icon={<ListChecks aria-hidden="true" className="size-4" />} />
        <StatCard label="Succeeded" value={String(succeeded)} tone="text-success" icon={<CircleCheck aria-hidden="true" className="size-4 text-success" />} />
        <StatCard label="Failed" value={String(failed)} tone="text-danger" icon={<TriangleAlert aria-hidden="true" className="size-4 text-danger" />} />
        <StatCard label={`Spend ${periodLabel}`} value={formatCents(spend)} tone="text-accent" icon={<Coins aria-hidden="true" className="size-4 text-accent" />} />
      </div>

      <Card className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor="activity-search" className="sr-only">Search tasks</label>
          <input
            id="activity-search"
            type="search"
            value={query}
            onChange={(e) => resetPage(setQuery)(e.target.value)}
            placeholder="Search tasks…"
            className="h-10 w-full rounded-control border border-border bg-surface-raised px-3 text-sm text-foreground placeholder:text-subtle focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
        <div>
          <label htmlFor="activity-status" className="sr-only">Status</label>
          <select id="activity-status" value={status} onChange={(e) => resetPage(setStatus)(e.target.value as "all" | TaskStatus)} className={selectClasses}>
            <option value="all">All statuses</option>
            <option value="succeeded">Succeeded</option>
            <option value="failed">Failed</option>
            <option value="running">Running</option>
            <option value="paused">Paused at cap</option>
          </select>
        </div>
        <div>
          <label htmlFor="activity-agent" className="sr-only">Agent</label>
          <select id="activity-agent" value={agent} onChange={(e) => resetPage(setAgent)(e.target.value)} className={selectClasses}>
            <option value="all">All agents</option>
            {activeAgentNames.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="activity-range" className="sr-only">Date range</label>
          <select id="activity-range" value={range} onChange={(e) => resetPage(setRange)(e.target.value as Range)} className={selectClasses}>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="month">This month</option>
            <option value="90d">Last 90 days</option>
          </select>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={History}
            title={tasks.length === 0 ? "No activity yet" : "No tasks match these filters"}
            description={
              tasks.length === 0
                ? "Every task you give Baba shows up here, with its steps, files and cost."
                : "Try a different status, agent or date range."
            }
            action={tasks.length === 0 ? <ButtonLink href={routes.ask}>Ask Baba</ButtonLink> : undefined}
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          {/* Table: large screens */}
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-subtle">
                  <th scope="col" className="px-4 py-3 font-medium">Task</th>
                  <th scope="col" className="px-4 py-3 font-medium">Agents</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                  <th scope="col" className="px-4 py-3 font-medium">Started</th>
                  <th scope="col" className="px-4 py-3 font-medium">Duration</th>
                  <th scope="col" className="px-4 py-3 font-medium">Cost</th>
                  <th scope="col" className="px-4 py-3"><span className="sr-only">Details</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visible.map((t) => (
                  <tr key={t.id} className="cursor-pointer transition-colors hover:bg-surface-raised/50" onClick={() => setSelectedId(t.id)}>
                    <td className="max-w-xs px-4 py-3.5">
                      <p className="truncate font-medium text-foreground">{t.request}</p>
                    </td>
                    <td className="px-4 py-3.5"><AgentChips agents={taskAgents(t)} /></td>
                    <td className="px-4 py-3.5">
                      <RunStatusBadge status={t.status} />
                      {t.status === "failed" && t.error && <p className="mt-1 max-w-[14rem] truncate text-[11px] text-danger">{t.error}</p>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-xs text-muted"><LocalTime iso={t.startedAt} /></td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-xs text-muted">{durationBetween(t.startedAt, t.finishedAt)}</td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-xs font-semibold text-foreground">{formatCents(t.costCents)}</td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedId(t.id);
                        }}
                        aria-label={`Details for ${t.request}`}
                        className="rounded-md p-1 text-subtle hover:text-foreground"
                      >
                        <ChevronRight aria-hidden="true" className="size-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cards: phones and tablets */}
          <ul className="divide-y divide-border lg:hidden">
            {visible.map((t) => (
              <li key={t.id}>
                <button type="button" onClick={() => setSelectedId(t.id)} className="w-full p-4 text-left transition-colors hover:bg-surface-raised/50">
                  <div className="flex items-start justify-between gap-3">
                    <p className="line-clamp-2 text-sm font-medium text-foreground">{t.request}</p>
                    <RunStatusBadge status={t.status} />
                  </div>
                  {t.status === "failed" && t.error && <p className="mt-1 line-clamp-1 text-xs text-danger">{t.error}</p>}
                  <div className="mt-3 flex items-center justify-between text-xs text-muted">
                    <AgentChips agents={taskAgents(t)} />
                    <span>
                      <span className="font-semibold text-foreground">{formatCents(t.costCents)}</span> · <LocalTime iso={t.startedAt} />
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {filtered.length > PAGE_SIZE && (
        <nav aria-label="Pages" className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
          <p>
            Showing <span className="text-foreground">{(current - 1) * PAGE_SIZE + 1}–{Math.min(current * PAGE_SIZE, filtered.length)}</span> of{" "}
            <span className="text-foreground">{filtered.length}</span>
          </p>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="secondary" disabled={current === 1} onClick={() => setPage(current - 1)}>
              Previous
            </Button>
            <span className="px-2 text-xs">
              Page {current} of {pages}
            </span>
            <Button size="sm" variant="secondary" disabled={current === pages} onClick={() => setPage(current + 1)}>
              Next
            </Button>
          </div>
        </nav>
      )}

      <Sheet
        open={selected !== null}
        onClose={() => setSelectedId(null)}
        side="wide-right"
        title="Task details"
        footer={
          selected?.conversationId ? (
            <ButtonLink href={askLink(selected)} fullWidth>
              <MessageSquare aria-hidden="true" className="size-4" />
              Open in Ask Baba
            </ButtonLink>
          ) : undefined
        }
      >
        {selected && (
          <div className="space-y-6 p-4">
            <div>
              <RunStatusBadge status={selected.status} />
              <h3 className="mt-2 whitespace-pre-line text-base font-semibold leading-snug text-foreground">{selected.request}</h3>
              <p className="mt-2 text-xs text-muted">
                Started <LocalTime iso={selected.startedAt} className="text-foreground" /> · Took{" "}
                <span className="text-foreground">{durationBetween(selected.startedAt, selected.finishedAt)}</span>
              </p>
              {selected.status === "failed" && selected.error && <p className="mt-2 text-sm text-danger">{selected.error}</p>}
              {selected.status === "paused" && (
                <p className="mt-2 text-sm text-warning">Paused at its spending cap. Open it in Ask Baba and click Continue to finish.</p>
              )}
            </div>

            <dl className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-surface-raised p-4">
              <div>
                <dt className="text-xs text-subtle">Total cost</dt>
                <dd className="mt-0.5 text-xl font-bold text-accent">{formatCents(selected.costCents)}</dd>
              </div>
              <div>
                <dt className="text-xs text-subtle">Spending cap</dt>
                <dd className="mt-0.5 text-xl font-bold text-foreground">{selected.capCents ? formatCents(selected.capCents) : "—"}</dd>
              </div>
            </dl>

            <section>
              <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-subtle">Steps</h4>
              {selected.steps.length === 0 ? (
                <p className="text-sm text-subtle">
                  {selected.status === "running" ? "Steps appear here when the task finishes." : "Baba answered directly, without separate steps."}
                </p>
              ) : (
                <ol className="relative space-y-4 border-l border-border pl-5">
                  {selected.steps.map((step) => (
                    <li key={step.id} className="relative">
                      <span aria-hidden="true" className={cn("absolute -left-[25px] top-1 size-2.5 rounded-full ring-4 ring-surface", stepDot(step, selected))} />
                      <p className="text-sm text-foreground">
                        {step.label}
                        {step.status === "failed" && <span className="ml-1.5 text-xs text-danger">(failed)</span>}
                      </p>
                      <p className="text-[11px] text-subtle">
                        {step.agent ? `${step.agent} · ` : ""}
                        <LocalTime iso={step.at} format="time" />
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <section>
              <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-subtle">Files created</h4>
              {selected.files.length === 0 ? (
                <p className="text-sm text-subtle">No files in this task.</p>
              ) : (
                <ul className="space-y-2">
                  {selected.files.map((f) => (
                    <li key={f.id} className="flex items-center justify-between gap-2 rounded-control border border-border bg-surface-raised p-3">
                      <span className="flex min-w-0 items-center gap-2.5">
                        <FileText aria-hidden="true" className="size-4 shrink-0 text-accent" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm text-foreground">{f.name}</span>
                          <span className="text-[11px] text-subtle">{formatBytes(f.sizeBytes)}</span>
                        </span>
                      </span>
                      {f.downloadUrl ? (
                        <a href={f.downloadUrl} download className={buttonClasses({ size: "sm", variant: "secondary" })} aria-label={`Download ${f.name}`}>
                          <Download aria-hidden="true" className="size-3.5" />
                          Download
                        </a>
                      ) : (
                        <span className="text-[11px] text-subtle">Chat deleted</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </Sheet>
    </div>
  );
}
