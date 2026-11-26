"use client";

import { ArrowDown, ArrowUp, History, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { LocalTime } from "@/components/ui/local-time";
import { inputClasses, selectClasses } from "@/components/ui/input";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { cleanSteps, MAX_STEPS, STEP_TYPES, type StepType, type WorkflowStep } from "@/lib/workflows/steps";

const TONE: Record<StepType, string> = {
  do: "border-border",
  check: "border-info/40",
  approve: "border-warning/50",
  notify: "border-accent/40",
};

const newId = () => Math.random().toString(36).slice(2, 10);

/** Ordered steps: Do / Only continue if / Ask me first / Notify me. */
export function WorkflowStepsEditor({ steps, onChange }: { steps: WorkflowStep[]; onChange: (steps: WorkflowStep[]) => void }) {
  const update = (id: string, patch: Partial<WorkflowStep>) => onChange(steps.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const move = (index: number, by: number) => {
    const next = [...steps];
    const [item] = next.splice(index, 1);
    next.splice(index + by, 0, item);
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-semibold text-muted">Steps (optional)</span>
        <span className="text-[11px] text-subtle">
          {steps.length}/{MAX_STEPS}
        </span>
      </div>
      {steps.length === 0 && <p className="text-xs text-subtle">Add steps to control the order, add checks, or make Baba ask you before a step.</p>}
      <ol className="space-y-2">
        {steps.map((step, i) => {
          const meta = STEP_TYPES.find((t) => t.type === step.type)!;
          return (
            <li key={step.id} className={cn("rounded-control border bg-surface-raised p-2.5", TONE[step.type])}>
              <div className="mb-2 flex items-center gap-2">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface text-[11px] font-semibold text-foreground">{i + 1}</span>
                <select
                  aria-label={`Step ${i + 1} type`}
                  className={cn(selectClasses, "h-8 flex-1 text-xs")}
                  value={step.type}
                  onChange={(e) => update(step.id, { type: e.target.value as StepType })}
                >
                  {STEP_TYPES.map((t) => (
                    <option key={t.type} value={t.type}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)} className="rounded p-1 text-subtle hover:text-foreground disabled:opacity-30">
                  <ArrowUp aria-hidden="true" className="size-4" />
                </button>
                <button type="button" aria-label="Move down" disabled={i === steps.length - 1} onClick={() => move(i, 1)} className="rounded p-1 text-subtle hover:text-foreground disabled:opacity-30">
                  <ArrowDown aria-hidden="true" className="size-4" />
                </button>
                <button type="button" aria-label="Remove step" onClick={() => onChange(steps.filter((s) => s.id !== step.id))} className="rounded p-1 text-subtle hover:text-danger">
                  <Trash2 aria-hidden="true" className="size-4" />
                </button>
              </div>
              <textarea
                aria-label={`Step ${i + 1}`}
                rows={2}
                maxLength={1000}
                className={cn(inputClasses, "text-sm")}
                placeholder={meta.placeholder}
                value={step.text}
                onChange={(e) => update(step.id, { text: e.target.value })}
              />
            </li>
          );
        })}
      </ol>
      {steps.length < MAX_STEPS && (
        <div className="flex flex-wrap gap-1.5">
          {STEP_TYPES.map((t) => (
            <button
              key={t.type}
              type="button"
              onClick={() => onChange([...steps, { id: newId(), type: t.type, text: "" }])}
              className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-muted hover:border-accent/40 hover:text-foreground"
            >
              <Plus aria-hidden="true" className="size-3" /> {t.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export type WorkflowVersion = {
  version: number;
  name: string;
  instruction: string;
  steps: WorkflowStep[];
  frequency: string;
  dayOfWeek: number | null;
  timeOfDay: string | null;
  capUsd: number;
  createdAt: string;
};

/** Earlier versions of a workflow; "Use" loads one into the form (saving it makes a new version). */
export function WorkflowHistory({ workflowId, onUse }: { workflowId: string; onUse: (v: WorkflowVersion) => void }) {
  const [versions, setVersions] = useState<WorkflowVersion[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    getSupabaseBrowser()
      .from("workflow_versions")
      .select("version, name, instruction, steps, frequency, day_of_week, time_of_day, cap_usd, created_at")
      .eq("workflow_id", workflowId)
      .order("version", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (cancelled) return;
        setVersions(
          (data ?? []).map((v) => ({
            version: v.version,
            name: v.name,
            instruction: v.instruction,
            steps: cleanSteps(v.steps),
            frequency: v.frequency,
            dayOfWeek: v.day_of_week,
            timeOfDay: v.time_of_day,
            capUsd: Number(v.cap_usd),
            createdAt: v.created_at,
          })),
        );
      });
    return () => {
      cancelled = true;
    };
  }, [workflowId]);

  if (!versions || versions.length <= 1) return null;
  return (
    <details className="rounded-control border border-border">
      <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-xs text-muted">
        <History aria-hidden="true" className="size-3.5" /> Version history ({versions.length})
      </summary>
      <ul className="divide-y divide-border">
        {versions.map((v, i) => (
          <li key={v.version} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
            <span className="text-muted">
              v{v.version} · {v.steps.length} step{v.steps.length === 1 ? "" : "s"} · <LocalTime iso={v.createdAt} />
            </span>
            {i === 0 ? (
              <span className="text-subtle">Current</span>
            ) : (
              <button type="button" onClick={() => onUse(v)} className="font-medium text-accent hover:underline">
                Use this version
              </button>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}
