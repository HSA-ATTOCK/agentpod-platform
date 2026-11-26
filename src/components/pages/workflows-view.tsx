"use client";

import { CalendarClock, Info, Play, Plus, Repeat } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ActionMenu } from "@/components/ui/action-menu";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FieldError } from "@/components/ui/field-error";
import { Input, selectClasses } from "@/components/ui/input";
import { LocalTime } from "@/components/ui/local-time";
import { PageHeader } from "@/components/ui/page-header";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { routes } from "@/config/routes";
import { formatCents } from "@/lib/format";
import { nextSlot, shortZone } from "@/lib/schedule";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { WorkflowRecord } from "@/types/app-data";
import { WorkflowHistory, WorkflowStepsEditor } from "@/components/workflows/workflow-steps";
import { cleanSteps, workflowPrompt, type WorkflowStep } from "@/lib/workflows/steps";
import { RunStatusBadge } from "./run-status-badge";

// Shown Monday-first; stored as 0 = Sunday … 6 = Saturday
const DAYS = [
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
  { label: "Sun", value: 0 },
];
type Frequency = WorkflowRecord["frequency"];
type Draft = { id?: string; name: string; instruction: string; frequency: Frequency; day: number; time: string; cap: string; steps: WorkflowStep[] };

const emptyDraft: Draft = { name: "", instruction: "", frequency: "manual", day: 1, time: "09:00", cap: "1.00", steps: [] };

function scheduleLabel(wf: Pick<WorkflowRecord, "frequency" | "dayOfWeek" | "timeOfDay">) {
  const time = wf.timeOfDay?.slice(0, 5) ?? "09:00";
  if (wf.frequency === "manual") return "Manual";
  if (wf.frequency === "daily") return `Every day at ${time}`;
  if (wf.frequency === "monthly") return `1st of each month at ${time}`;
  const day = DAYS.find((d) => d.value === wf.dayOfWeek)?.label ?? "Mon";
  return `Every ${day} at ${time}`;
}

/** "Today, 13:27" / "Tue 24 Nov, 13:27" in the workspace's timezone. */
function nextRunLabel(wf: WorkflowRecord, timeZone: string) {
  if (!wf.enabled || wf.frequency === "manual") return null;
  const next = nextSlot(wf, timeZone, Date.now());
  if (next === null) return null;
  const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { timeZone, ...opts }).format(next);
  const day = fmt({ year: "numeric", month: "2-digit", day: "2-digit" });
  const today = new Intl.DateTimeFormat("en-GB", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(Date.now());
  const time = fmt({ hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  return day === today ? `Today, ${time}` : `${fmt({ weekday: "short", day: "numeric", month: "short" })}, ${time}`;
}

function NextRun({ wf, timeZone }: { wf: WorkflowRecord; timeZone: string }) {
  const label = nextRunLabel(wf, timeZone);
  if (!label) return <span className="text-subtle">—</span>;
  return <span suppressHydrationWarning>{label}</span>;
}

function runPrompt(wf: WorkflowRecord) {
  const params = new URLSearchParams({ prompt: workflowPrompt(wf.instruction, wf.steps), workflow: wf.id });
  return `${routes.ask}?${params.toString()}`;
}

function LastRun({ wf }: { wf: WorkflowRecord }) {
  const last = wf.runs[0];
  if (!last) return <span className="text-xs text-subtle">Never run</span>;
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <RunStatusBadge status={last.status} />
        <LocalTime iso={last.startedAt} className="text-[11px] text-subtle" />
      </div>
      {last.status === "failed" && last.error && <p className="max-w-[16rem] truncate text-[11px] text-danger">{last.error}</p>}
      {last.conversationId && (
        <Link href={`${routes.ask}?c=${last.conversationId}`} className="inline-block text-[11px] font-medium text-accent hover:underline">
          {last.status === "running" ? "Watch it work" : "View result"}
        </Link>
      )}
    </div>
  );
}

function averageCost(wf: WorkflowRecord) {
  const finished = wf.runs.filter((r) => r.status !== "running");
  if (finished.length === 0) return null;
  return formatCents(Math.round(finished.reduce((s, r) => s + r.costCents, 0) / finished.length));
}

type WorkflowsViewProps = {
  workflows: WorkflowRecord[];
  workspaceId: string;
  userId: string;
  canWrite: boolean;
  canManageAll: boolean;
  /** The workspace timezone schedules run in (Settings → Workspace). */
  timeZone: string;
};

export function WorkflowsView({ workflows, workspaceId, userId, canWrite, canManageAll, timeZone }: WorkflowsViewProps) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<{ name?: string; instruction?: string; cap?: string }>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { toast, showToast } = useToast();
  const supabase = getSupabaseBrowser();

  const canChange = (wf: WorkflowRecord) => canManageAll || (canWrite && wf.createdBy === userId);

  function openNew() {
    setErrors({});
    setSaveError(null);
    setDraft({ ...emptyDraft });
  }

  function openEdit(wf: WorkflowRecord) {
    setErrors({});
    setSaveError(null);
    setDraft({
      id: wf.id,
      name: wf.name,
      instruction: wf.instruction,
      frequency: wf.frequency,
      day: wf.dayOfWeek ?? 1,
      time: wf.timeOfDay?.slice(0, 5) ?? "09:00",
      cap: wf.capUsd.toFixed(2),
      steps: wf.steps,
    });
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    const cap = Number(draft.cap);
    const next = {
      name: draft.name.trim() ? undefined : "Give the workflow a name.",
      instruction: draft.instruction.trim() ? undefined : "Tell Baba what to do.",
      cap: Number.isFinite(cap) && cap > 0 && cap <= 1000 ? undefined : "Enter an amount between 0.01 and 1000.",
    };
    setErrors(next);
    if (next.name || next.instruction || next.cap) return;

    setSaving(true);
    setSaveError(null);
    const values = {
      name: draft.name.trim().slice(0, 120),
      instruction: draft.instruction.trim(),
      frequency: draft.frequency,
      day_of_week: draft.frequency === "weekly" ? draft.day : null,
      time_of_day: draft.frequency === "manual" ? null : draft.time,
      cap_usd: Math.round(cap * 100) / 100,
      enabled: draft.frequency !== "manual",
      steps: cleanSteps(draft.steps),
    };
    const { error } = draft.id
      ? // A changed schedule only counts from now on (a time that already passed today doesn't fire at once)
        await supabase.from("workflows").update({ ...values, last_run_slot: new Date().toISOString() }).eq("id", draft.id)
      : await supabase.from("workflows").insert({ ...values, workspace_id: workspaceId, created_by: userId });
    setSaving(false);
    if (error) {
      // Plan limits come from the database with a readable message
      setSaveError(error.code === "P0001" ? error.message : "Couldn't save the workflow. Please try again.");
      return;
    }
    setDraft(null);
    showToast(draft.id ? "Workflow updated." : "Workflow created.");
    router.refresh();
  }

  async function duplicate(wf: WorkflowRecord) {
    const { error } = await supabase.from("workflows").insert({
      workspace_id: workspaceId,
      created_by: userId,
      name: `${wf.name} (copy)`.slice(0, 120),
      instruction: wf.instruction,
      frequency: wf.frequency,
      day_of_week: wf.dayOfWeek,
      time_of_day: wf.timeOfDay,
      cap_usd: wf.capUsd,
      enabled: wf.enabled,
      steps: wf.steps,
    });
    showToast(error ? (error.code === "P0001" ? error.message : "Couldn't duplicate the workflow.") : "Workflow duplicated.");
    if (!error) router.refresh();
  }

  async function remove(wf: WorkflowRecord) {
    if (!window.confirm(`Delete "${wf.name}"? Its past runs stay in Activity.`)) return;
    const { error } = await supabase.from("workflows").delete().eq("id", wf.id);
    showToast(error ? "Couldn't delete the workflow." : "Workflow deleted.");
    if (!error) router.refresh();
  }

  async function webhook(wf: WorkflowRecord, action: "create" | "remove") {
    if (action === "create" && wf.hasWebhook && !window.confirm("Replace the webhook link? The old link stops working.")) return;
    const res = await fetch("/api/workflows/webhook", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workflowId: wf.id, action }) });
    const data = (await res.json().catch(() => ({}))) as { url?: string | null; error?: string };
    if (!res.ok) {
      showToast(data.error ?? "That didn't work.");
      return;
    }
    if (data.url) {
      // Shown once: only a hash is stored
      window.prompt("Copy this webhook link now — it won't be shown again. POST JSON or text to it to run the workflow (the workflow must be On):", data.url);
    } else {
      showToast("Webhook link removed.");
    }
    router.refresh();
  }

  function actions(wf: WorkflowRecord) {
    const list: { label: string; onSelect: () => void; danger?: boolean }[] = [];
    if (canWrite) list.push({ label: "Run now", onSelect: () => router.push(runPrompt(wf)) });
    if (canChange(wf)) list.push({ label: "Edit", onSelect: () => openEdit(wf) });
    if (canWrite) list.push({ label: "Duplicate", onSelect: () => void duplicate(wf) });
    if (canChange(wf)) {
      list.push({ label: wf.hasWebhook ? "New webhook link" : "Create webhook link", onSelect: () => void webhook(wf, "create") });
      if (wf.hasWebhook) list.push({ label: "Remove webhook link", onSelect: () => void webhook(wf, "remove") });
    }
    if (canChange(wf)) list.push({ label: "Delete", danger: true, onSelect: () => void remove(wf) });
    return list;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workflows"
        description="Save tasks you repeat and run them with one click."
        actions={
          canWrite ? (
            <Button onClick={openNew}>
              <Plus aria-hidden="true" className="size-4" />
              New workflow
            </Button>
          ) : undefined
        }
      />

      <div className="flex items-start gap-2.5 rounded-card border border-border bg-surface p-3.5 text-xs text-muted">
        <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-info" />
        <p>
          Scheduled workflows run by themselves at their time in <span className="font-medium text-foreground">{timeZone.replace(/_/g, " ")}</span>{" "}
          time (change it in Settings → Workspace). Each run appears in Activity, and you&apos;re emailed if it fails or
          pauses. <span className="font-medium text-foreground">Run now</span> opens a workflow in Ask Baba straight away.
        </p>
      </div>

      {workflows.length === 0 ? (
        <Card>
          <EmptyState
            icon={Repeat}
            title="No workflows yet"
            description="Save a task you ask Baba for often, like a weekly competitor check, and run it any time."
            action={canWrite ? <Button onClick={openNew}>Create your first workflow</Button> : undefined}
          />
        </Card>
      ) : (
        <>
          {/* Table: large screens */}
          <Card className="hidden overflow-x-auto lg:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-subtle">
                  <th scope="col" className="px-4 py-3 font-medium">Workflow</th>
                  <th scope="col" className="px-4 py-3 font-medium">Schedule</th>
                  <th scope="col" className="px-4 py-3 font-medium">Next run</th>
                  <th scope="col" className="px-4 py-3 font-medium">Last run</th>
                  <th scope="col" className="px-4 py-3 font-medium">Runs</th>
                  <th scope="col" className="px-4 py-3 font-medium">Avg cost</th>
                  <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {workflows.map((wf) => (
                  <tr key={wf.id} className="align-top">
                    <td className="max-w-xs px-4 py-4">
                      <p className="font-medium text-foreground">{wf.name}</p>
                      <p className="mt-0.5 truncate text-xs text-muted">{wf.steps.length ? `${wf.steps.length} steps · ` : ""}{wf.instruction}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-xs text-muted">
                      {scheduleLabel(wf)}
                    {wf.frequency !== "manual" && (
                      <span className="text-subtle">
                        · next <NextRun wf={wf} timeZone={timeZone} />
                      </span>
                    )}
                      {wf.frequency !== "manual" && <span className="block text-[11px] text-subtle">{shortZone(timeZone)} time</span>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-xs text-foreground">
                      <NextRun wf={wf} timeZone={timeZone} />
                    </td>
                    <td className="px-4 py-4"><LastRun wf={wf} /></td>
                    <td className="px-4 py-4 text-xs text-foreground">{wf.runs.length >= 10 ? "10+" : wf.runs.length}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-xs text-foreground">{averageCost(wf) ?? "—"}</td>
                    <td className="px-2 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {canWrite && (
                          <Button size="sm" variant="secondary" onClick={() => router.push(runPrompt(wf))}>
                            <Play aria-hidden="true" className="size-3.5" />
                            Run now
                          </Button>
                        )}
                        <ActionMenu label={`${wf.name} options`} actions={actions(wf)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Cards: phones and tablets */}
          <ul className="space-y-3 lg:hidden">
            {workflows.map((wf) => (
              <li key={wf.id}>
                <Card className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{wf.name}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted">{wf.steps.length ? `${wf.steps.length} steps · ` : ""}{wf.instruction}</p>
                    </div>
                    <ActionMenu label={`${wf.name} options`} actions={actions(wf)} />
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted">
                    <CalendarClock aria-hidden="true" className="size-3.5" />
                    {scheduleLabel(wf)}
                    {averageCost(wf) && <span className="ml-auto text-foreground">{averageCost(wf)} avg</span>}
                  </div>
                  <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
                    <LastRun wf={wf} />
                    {canWrite && (
                      <Button size="sm" variant="secondary" onClick={() => router.push(runPrompt(wf))}>
                        <Play aria-hidden="true" className="size-3.5" />
                        Run now
                      </Button>
                    )}
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}

      <Sheet open={draft !== null} onClose={() => setDraft(null)} side="center" title={draft?.id ? "Edit workflow" : "New workflow"}>
        {draft && (
          <form noValidate onSubmit={save} className="space-y-4 p-4">
            {saveError && <Alert variant="error">{saveError}</Alert>}
            <Input
              id="wf-name"
              label="Name"
              required
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="e.g. Weekly competitor pricing check"
              error={errors.name}
            />
            <div>
              <label htmlFor="wf-instruction" className="mb-1.5 block text-xs font-semibold text-muted">
                What should Baba do? <span aria-hidden="true" className="text-danger">*</span>
              </label>
              <textarea
                id="wf-instruction"
                rows={5}
                value={draft.instruction}
                onChange={(e) => setDraft({ ...draft, instruction: e.target.value })}
                aria-invalid={errors.instruction ? true : undefined}
                aria-describedby={errors.instruction ? "wf-instruction-error" : undefined}
                placeholder="Describe the task like you would in Ask Baba"
                className={cn(
                  "w-full rounded-control border bg-surface-raised p-3 text-sm text-foreground placeholder:text-subtle focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent",
                  errors.instruction ? "border-danger" : "border-border",
                )}
              />
              <FieldError id="wf-instruction-error" message={errors.instruction} />
            </div>
            <WorkflowStepsEditor
              steps={draft.steps}
              onChange={(steps) => setDraft({ ...draft, steps })}
              trigger={draft.frequency === "manual" ? "Run now or webhook" : `${scheduleLabel({ frequency: draft.frequency, dayOfWeek: draft.day, timeOfDay: draft.time })} (${shortZone(timeZone)})`}
            />
            {draft.id && (
              <WorkflowHistory
                workflowId={draft.id}
                onUse={(v) =>
                  setDraft({
                    ...draft,
                    name: v.name,
                    instruction: v.instruction,
                    steps: v.steps,
                    frequency: v.frequency as Frequency,
                    day: v.dayOfWeek ?? 1,
                    time: v.timeOfDay?.slice(0, 5) ?? "09:00",
                    cap: v.capUsd.toFixed(2),
                  })
                }
              />
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="wf-frequency" className="mb-1.5 block text-xs font-semibold text-muted">Schedule</label>
                <select
                  id="wf-frequency"
                  value={draft.frequency}
                  onChange={(e) => setDraft({ ...draft, frequency: e.target.value as Frequency })}
                  className={selectClasses}
                >
                  <option value="manual">Manual</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <Input
                id="wf-time"
                type="time"
                label="Time"
                value={draft.time}
                disabled={draft.frequency === "manual"}
                onChange={(e) => setDraft({ ...draft, time: e.target.value })}
                hint={draft.frequency === "manual" ? undefined : `${shortZone(timeZone)} time`}
              />
            </div>
            {draft.frequency === "weekly" && (
              <fieldset>
                <legend className="mb-1.5 text-xs font-semibold text-muted">Day</legend>
                <div className="flex flex-wrap gap-1.5">
                  {DAYS.map((day) => (
                    <button
                      key={day.value}
                      type="button"
                      aria-pressed={draft.day === day.value}
                      onClick={() => setDraft({ ...draft, day: day.value })}
                      className={cn(
                        "h-9 min-w-11 rounded-lg border px-2 text-xs font-medium transition-colors",
                        draft.day === day.value
                          ? "border-accent bg-accent text-accent-foreground"
                          : "border-border bg-surface-raised text-muted hover:text-foreground",
                      )}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}
            <Input
              id="wf-cap"
              type="number"
              min="0.01"
              step="0.01"
              label="Spending cap per run ($)"
              value={draft.cap}
              onChange={(e) => setDraft({ ...draft, cap: e.target.value })}
              error={errors.cap}
              hint="Each run pauses if it reaches this amount."
            />
            <div className="flex items-start gap-3 rounded-control border border-border bg-surface-raised p-3">
              <input type="checkbox" checked disabled readOnly id="wf-approval" className="mt-0.5 size-4 accent-accent" />
              <label htmlFor="wf-approval" className="text-sm text-foreground">
                Ask for my approval before sensitive actions
                <span className="block text-xs text-subtle">Always on. Sending emails, posting messages and changing records need your OK.</span>
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button variant="secondary" onClick={() => setDraft(null)}>
                Cancel
              </Button>
              <Button type="submit" loading={saving} loadingText="Saving…">
                {draft.id ? "Save" : "Create workflow"}
              </Button>
            </div>
          </form>
        )}
      </Sheet>
      {toast}
    </div>
  );
}
