"use client";

import { CalendarClock, Plus, Repeat } from "lucide-react";
import { useState, type FormEvent } from "react";
import { ActionMenu } from "@/components/ui/action-menu";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FieldError } from "@/components/ui/field-error";
import { Input, selectClasses } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Sheet } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { sampleWorkflowList, type SampleWorkflow } from "@/lib/sample-pages";
import { cn } from "@/lib/utils";
import { RunStatusBadge } from "./run-status-badge";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
type Frequency = "manual" | "daily" | "weekly" | "monthly";
type Draft = { id?: string; name: string; instruction: string; frequency: Frequency; day: string; time: string; cap: string };

const emptyDraft: Draft = { name: "", instruction: "", frequency: "weekly", day: "Mon", time: "09:00", cap: "1.00" };

function scheduleLabel(d: Draft) {
  if (d.frequency === "manual") return "Manual";
  if (d.frequency === "daily") return `Every day at ${d.time}`;
  if (d.frequency === "monthly") return `On the 1st of each month at ${d.time}`;
  return `Every ${d.day} at ${d.time}`;
}

function LastRun({ wf }: { wf: SampleWorkflow }) {
  if (!wf.lastRun) return <span className="text-subtle">Never run</span>;
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <RunStatusBadge status={wf.lastRun.status} />
        <span className="text-[11px] text-subtle">{wf.lastRun.label}</span>
      </div>
      {wf.lastRun.reason && <p className="text-[11px] text-danger">{wf.lastRun.reason}</p>}
    </div>
  );
}

export function WorkflowsView() {
  const [workflows, setWorkflows] = useState(sampleWorkflowList);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<{ name?: string; instruction?: string }>({});
  const { toast, showToast } = useToast();

  function openNew() {
    setErrors({});
    setDraft({ ...emptyDraft });
  }

  function openEdit(wf: SampleWorkflow) {
    setErrors({});
    setDraft({ ...emptyDraft, id: wf.id, name: wf.name, instruction: wf.instruction, frequency: wf.schedule === "Manual" ? "manual" : "weekly" });
  }

  function save(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    const next = {
      name: draft.name.trim() ? undefined : "Give the workflow a name.",
      instruction: draft.instruction.trim() ? undefined : "Tell Baba what to do.",
    };
    setErrors(next);
    if (next.name || next.instruction) return;

    const saved: SampleWorkflow = {
      id: draft.id ?? crypto.randomUUID(),
      name: draft.name.trim(),
      instruction: draft.instruction.trim(),
      schedule: scheduleLabel(draft),
      lastRun: workflows.find((w) => w.id === draft.id)?.lastRun ?? null,
      nextRun: draft.frequency === "manual" ? "—" : "Scheduling not connected yet",
      averageCost: workflows.find((w) => w.id === draft.id)?.averageCost ?? null,
      enabled: draft.frequency !== "manual",
    };
    setWorkflows((prev) => (draft.id ? prev.map((w) => (w.id === draft.id ? saved : w)) : [saved, ...prev]));
    setDraft(null);
    showToast("Workflow saved on this page only (sample — scheduling isn't connected yet).");
  }

  function actions(wf: SampleWorkflow) {
    return [
      { label: "Run now", onSelect: () => showToast("Running workflows isn't available yet. Use Ask Baba for now.") },
      { label: "Edit", onSelect: () => openEdit(wf) },
      {
        label: "Duplicate",
        onSelect: () => setWorkflows((prev) => [{ ...wf, id: crypto.randomUUID(), name: `${wf.name} (copy)`, lastRun: null }, ...prev]),
      },
      { label: "Delete", danger: true, onSelect: () => setWorkflows((prev) => prev.filter((w) => w.id !== wf.id)) },
    ];
  }

  function toggle(wf: SampleWorkflow, enabled: boolean) {
    setWorkflows((prev) => prev.map((w) => (w.id === wf.id ? { ...w, enabled } : w)));
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Workflows"
        description="Save tasks you repeat and let Baba run them on a schedule."
        sample
        actions={
          <Button onClick={openNew}>
            <Plus aria-hidden="true" className="size-4" />
            New workflow
          </Button>
        }
      />

      {workflows.length === 0 ? (
        <Card>
          <EmptyState
            icon={Repeat}
            title="No workflows yet"
            description="Turn any Ask Baba task into a workflow that runs on its own."
            action={<Button onClick={openNew}>Create your first workflow</Button>}
          />
        </Card>
      ) : (
        <>
          {/* Table: tablets and up */}
          <Card className="hidden overflow-x-auto lg:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-subtle">
                  <th scope="col" className="px-4 py-3 font-medium">Workflow</th>
                  <th scope="col" className="px-4 py-3 font-medium">Schedule</th>
                  <th scope="col" className="px-4 py-3 font-medium">Last run</th>
                  <th scope="col" className="px-4 py-3 font-medium">Next run</th>
                  <th scope="col" className="px-4 py-3 font-medium">Avg cost</th>
                  <th scope="col" className="px-4 py-3 font-medium">On</th>
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
                    <td className="whitespace-nowrap px-4 py-4 text-xs text-muted">{wf.schedule}</td>
                    <td className="px-4 py-4"><LastRun wf={wf} /></td>
                    <td className="whitespace-nowrap px-4 py-4 text-xs text-muted">{wf.nextRun}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-xs text-foreground">{wf.averageCost ?? "—"}</td>
                    <td className="px-4 py-4">
                      <Switch checked={wf.enabled} onChange={(v) => toggle(wf, v)} label={`Turn ${wf.name} on or off`} />
                    </td>
                    <td className="px-2 py-3 text-right">
                      <ActionMenu label={`${wf.name} options`} actions={actions(wf)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Cards: phones */}
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
                    {wf.schedule}
                    {wf.averageCost && <span className="ml-auto text-foreground">{wf.averageCost} avg</span>}
                  </div>
                  <div className="flex items-center justify-between border-t border-border pt-3">
                    <LastRun wf={wf} />
                    <Switch checked={wf.enabled} onChange={(v) => toggle(wf, v)} label={`Turn ${wf.name} on or off`} />
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}

      <Sheet
        open={draft !== null}
        onClose={() => setDraft(null)}
        side="center"
        title={draft?.id ? "Edit workflow" : "New workflow"}
      >
        {draft && (
          <form noValidate onSubmit={save} className="space-y-4 p-4">
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
                rows={4}
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
                      key={day}
                      type="button"
                      aria-pressed={draft.day === day}
                      onClick={() => setDraft({ ...draft, day })}
                      className={cn(
                        "h-9 min-w-11 rounded-lg border px-2 text-xs font-medium transition-colors",
                        draft.day === day
                          ? "border-accent bg-accent text-accent-foreground"
                          : "border-border bg-surface-raised text-muted hover:text-foreground",
                      )}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}
            <Input
              id="wf-cap"
              type="number"
              min="0.1"
              step="0.1"
              label="Spending cap per run ($)"
              value={draft.cap}
              onChange={(e) => setDraft({ ...draft, cap: e.target.value })}
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
              <Button type="submit">{draft.id ? "Save" : "Create workflow"}</Button>
            </div>
          </form>
        )}
      </Sheet>
      {toast}
    </div>
  );
}
