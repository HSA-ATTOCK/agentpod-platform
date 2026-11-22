"use client";

import { ChevronRight, CircleCheck, Coins, FileText, History, ListChecks, MessageSquare, TriangleAlert } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { selectClasses } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Sheet } from "@/components/ui/sheet";
import { routes } from "@/config/routes";
import { sampleTasks, type ActivityStep, type RunStatus, type SampleTask } from "@/lib/sample-pages";
import { cn } from "@/lib/utils";
import { RunStatusBadge } from "./run-status-badge";

const AGENTS = ["Baba", "Research Analyst", "Writer", "Data Analyst"];
const PAGE_SIZE = 5;

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("");
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

const stepDot: Record<ActivityStep["state"], string> = {
  done: "bg-success",
  failed: "bg-danger",
  paused: "bg-warning",
  running: "bg-info animate-pulse",
};

export function ActivityView() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | RunStatus>("all");
  const [agent, setAgent] = useState("all");
  const [range, setRange] = useState("month");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<SampleTask | null>(null);

  const q = query.trim().toLowerCase();
  const filtered = sampleTasks.filter(
    (t) =>
      (!q || t.task.toLowerCase().includes(q)) &&
      (status === "all" || t.status === status) &&
      (agent === "all" || t.agents.includes(agent)),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const visible = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const succeeded = sampleTasks.filter((t) => t.status === "succeeded").length;
  const failed = sampleTasks.filter((t) => t.status === "failed").length;
  const spend = sampleTasks.reduce((sum, t) => sum + Number(t.cost.replace("$", "")), 0);

  function resetPage<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPage(1);
    };
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity"
        description="Everything Baba and its specialists did, with the cost of each task."
        sample
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Tasks this month" value={String(sampleTasks.length)} icon={<ListChecks aria-hidden="true" className="size-4" />} />
        <StatCard label="Succeeded" value={String(succeeded)} tone="text-success" icon={<CircleCheck aria-hidden="true" className="size-4 text-success" />} />
        <StatCard label="Failed" value={String(failed)} tone="text-danger" icon={<TriangleAlert aria-hidden="true" className="size-4 text-danger" />} />
        <StatCard label="Spend this month" value={`$${spend.toFixed(2)}`} tone="text-accent" icon={<Coins aria-hidden="true" className="size-4 text-accent" />} />
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
          <select id="activity-status" value={status} onChange={(e) => resetPage(setStatus)(e.target.value as "all" | RunStatus)} className={selectClasses}>
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
            {AGENTS.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="activity-range" className="sr-only">Date range</label>
          <select id="activity-range" value={range} onChange={(e) => setRange(e.target.value)} className={selectClasses}>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="month">This month</option>
          </select>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={History}
            title="No activity found"
            description="Tasks you give Baba will show up here."
            action={<ButtonLink href={routes.ask}>Ask Baba</ButtonLink>}
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          {/* Table: tablets and up */}
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
                  <tr key={t.id} className="cursor-pointer transition-colors hover:bg-surface-raised/50" onClick={() => setSelected(t)}>
                    <td className="max-w-xs px-4 py-3.5">
                      <p className="truncate font-medium text-foreground">{t.task}</p>
                    </td>
                    <td className="px-4 py-3.5"><AgentChips agents={t.agents} /></td>
                    <td className="px-4 py-3.5">
                      <RunStatusBadge status={t.status} />
                      {t.reason && <p className="mt-1 text-[11px] text-danger">{t.reason}</p>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-xs text-muted">{t.started}</td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-xs text-muted">{t.duration}</td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-xs font-semibold text-foreground">{t.cost}</td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelected(t);
                        }}
                        aria-label={`Details for ${t.task}`}
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

          {/* Cards: phones */}
          <ul className="divide-y divide-border lg:hidden">
            {visible.map((t) => (
              <li key={t.id}>
                <button type="button" onClick={() => setSelected(t)} className="w-full p-4 text-left transition-colors hover:bg-surface-raised/50">
                  <div className="flex items-start justify-between gap-3">
                    <p className="line-clamp-2 text-sm font-medium text-foreground">{t.task}</p>
                    <RunStatusBadge status={t.status} />
                  </div>
                  {t.reason && <p className="mt-1 text-xs text-danger">{t.reason}</p>}
                  <div className="mt-3 flex items-center justify-between text-xs text-muted">
                    <AgentChips agents={t.agents} />
                    <span>
                      <span className="font-semibold text-foreground">{t.cost}</span> · {t.started}
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
            {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setPage(n)}
                aria-current={n === current ? "page" : undefined}
                className={cn(
                  "size-9 rounded-control text-xs font-medium",
                  n === current ? "bg-accent text-accent-foreground" : "text-muted hover:bg-surface-raised",
                )}
              >
                {n}
              </button>
            ))}
            <Button size="sm" variant="secondary" disabled={current === pages} onClick={() => setPage(current + 1)}>
              Next
            </Button>
          </div>
        </nav>
      )}

      <Sheet
        open={selected !== null}
        onClose={() => setSelected(null)}
        side="wide-right"
        title="Task details"
        footer={
          <ButtonLink href={routes.ask} fullWidth>
            <MessageSquare aria-hidden="true" className="size-4" />
            Open in Ask Baba
          </ButtonLink>
        }
      >
        {selected && (
          <div className="space-y-6 p-4">
            <div>
              <RunStatusBadge status={selected.status} />
              <h3 className="mt-2 text-base font-semibold leading-snug text-foreground">{selected.task}</h3>
              <p className="mt-2 text-xs text-muted">
                Started <span className="text-foreground">{selected.started}</span> · Took{" "}
                <span className="text-foreground">{selected.duration}</span>
              </p>
              {selected.reason && <p className="mt-2 text-sm text-danger">{selected.reason}</p>}
            </div>

            <dl className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-surface-raised p-4">
              <div>
                <dt className="text-xs text-subtle">Total cost</dt>
                <dd className="mt-0.5 text-xl font-bold text-accent">{selected.cost}</dd>
              </div>
              <div>
                <dt className="text-xs text-subtle">Spending cap</dt>
                <dd className="mt-0.5 text-xl font-bold text-foreground">{selected.cap}</dd>
              </div>
            </dl>

            <section>
              <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-subtle">Steps</h4>
              <ol className="relative space-y-4 border-l border-border pl-5">
                {selected.steps.map((step, i) => (
                  <li key={i} className="relative">
                    <span aria-hidden="true" className={cn("absolute -left-[25px] top-1 size-2.5 rounded-full ring-4 ring-surface", stepDot[step.state])} />
                    <p className="text-sm text-foreground">{step.title}</p>
                    <p className="text-[11px] text-subtle">{step.time}</p>
                  </li>
                ))}
              </ol>
            </section>

            <section>
              <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-subtle">Files created</h4>
              {selected.files.length === 0 ? (
                <p className="text-sm text-subtle">No files in this task.</p>
              ) : (
                <ul className="space-y-2">
                  {selected.files.map((f) => (
                    <li key={f.name} className="flex items-center justify-between gap-2 rounded-control border border-border bg-surface-raised p-3">
                      <span className="flex min-w-0 items-center gap-2.5">
                        <FileText aria-hidden="true" className="size-4 shrink-0 text-accent" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm text-foreground">{f.name}</span>
                          <span className="text-[11px] text-subtle">{f.size}</span>
                        </span>
                      </span>
                      <Button size="sm" variant="secondary" disabled title="Sample file">
                        Download
                      </Button>
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
