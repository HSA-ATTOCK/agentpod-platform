"use client";

import { CalendarClock, Info, Play, Plus, Repeat } from "lucide-react";
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
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { WorkflowRecord } from "@/types/app-data";
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
type Draft = { id?: string; name: string; instruction: string; frequency: Frequency; day: number; time: string; cap: string };

const emptyDraft: Draft = { name: "", instruction: "", frequency: "manual", day: 1, time: "09:00", cap: "1.00" };

function scheduleLabel(wf: Pick<WorkflowRecord, "frequency" | "dayOfWeek" | "timeOfDay">) {
  const time = wf.timeOfDay?.slice(0, 5) ?? "09:00";
  if (wf.frequency === "manual") return "Manual";
  if (wf.frequency === "daily") return `Every day at ${time}`;
  if (wf.frequency === "monthly") return `1st of each month at ${time}`;
  const day = DAYS.find((d) => d.value === wf.dayOfWeek)?.label ?? "Mon";
  return `Every ${day} at ${time}`;
}

function runPrompt(wf: WorkflowRecord) {
  const params = new URLSearchParams({ prompt: wf.instruction, workflow: wf.id });
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
};

export function WorkflowsView({ workflows, workspaceId, userId, canWrite, canManageAll }: WorkflowsViewProps) {
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
    };
    const { error } = draft.id
      ? await supabase.from("workflows").update(values).eq("id", draft.id)
      : await supabase.from("workflows").insert({ ...values, workspace_id: workspaceId, created_by: userId });
    setSaving(false);
    if (error) {
      setSaveError("Couldn't save the workflow. Please try again.");
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
    });
    showToast(error ? "Couldn't duplicate the workflow." : "Workflow duplicated.");
    if (!error) router.refresh();
  }

  async function remove(wf: WorkflowRecord) {
    if (!window.confirm(`Delete "${wf.name}"? Its past runs stay in Activity.`)) return;
    const { error } = await supabase.from("workflows").delete().eq("id", wf.id);
    showToast(error ? "Couldn't delete the workflow." : "Workflow deleted.");
    if (!error) router.refresh();
  }

  function actions(wf: WorkflowRecord) {
    const list: { label: string; onSelect: () => void; danger?: boolean }[] = [];
    if (canWrite) list.push({ label: "Run now", onSelect: () => router.push(runPrompt(wf)) });
    if (canChange(wf)) list.push({ label: "Edit", onSelect: () => openEdit(wf) });
    if (canWrite) list.push({ label: "Duplicate", onSelect: () => void duplicate(wf) });
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
          <span className="font-medium text-foreground">Run now</span> opens the workflow in Ask Baba, ready to send.
          Schedules are saved with each workflow; automatic scheduled runs are coming with the next agent update.
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
                      <p className="mt-0.5 truncate text-xs text-muted">{wf.instruction}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-xs text-muted">{scheduleLabel(wf)}</td>
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
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted">{wf.instruction}</p>
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
