/**
 * Multi-step workflows (PRD §12): an ordered list of steps that Baba carries out.
 * Shared by the browser (Run now) and the server (scheduled and webhook runs).
 *
 * - do:      an action ("Find unpaid invoices older than 30 days")
 * - check:   a condition; if it isn't true, Baba stops and reports why
 * - approve: Baba calls workflow_checkpoint, which waits for a person's approval before continuing
 * - notify:  Baba calls notify_me (bell + email to the person the workflow runs for)
 */

export type StepType = "do" | "check" | "approve" | "notify";
export type WorkflowStep = { id: string; type: StepType; text: string };

export const STEP_TYPES: { type: StepType; label: string; placeholder: string }[] = [
  { type: "do", label: "Do", placeholder: "e.g. Find invoices unpaid for more than 30 days in the Sales DB" },
  { type: "check", label: "Only continue if", placeholder: "e.g. at least one invoice was found" },
  { type: "approve", label: "Ask me first", placeholder: "e.g. Show me the reminder emails before sending" },
  { type: "notify", label: "Notify me", placeholder: "e.g. Send me a summary of what was sent" },
];

export const MAX_STEPS = 20;

/** Cleans steps coming from a form or the database. */
export function cleanSteps(value: unknown): WorkflowStep[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((s): s is WorkflowStep => Boolean(s) && typeof s === "object" && typeof (s as WorkflowStep).text === "string")
    .map((s, i) => ({
      id: typeof s.id === "string" && s.id ? s.id.slice(0, 40) : `s${i}`,
      type: (["do", "check", "approve", "notify"] as const).includes(s.type) ? s.type : "do",
      text: s.text.trim().slice(0, 1000),
    }))
    .filter((s) => s.text)
    .slice(0, MAX_STEPS);
}

/** The message Baba receives for a workflow: the goal, then the numbered steps with their rules. */
export function workflowPrompt(instruction: string, steps: WorkflowStep[]) {
  if (steps.length === 0) return instruction;
  const lines = steps.map((s, i) => {
    const n = i + 1;
    switch (s.type) {
      case "check":
        return `${n}. CHECK: only continue if ${s.text}. If it isn't true, stop here and tell me why (don't do the later steps).`;
      case "approve":
        return `${n}. ASK ME FIRST: ${s.text}. Call the workflow_checkpoint tool with a clear summary of what you're about to do, and wait for my approval before any later step.`;
      case "notify":
        return `${n}. NOTIFY ME: ${s.text}. Use the notify_me tool.`;
      default:
        return `${n}. ${s.text}`;
    }
  });
  return `${instruction.trim()}\n\nFollow these steps in order:\n${lines.join("\n")}\n\nIf a step can't be done, stop and explain. Never skip an "ASK ME FIRST" step.`;
}
