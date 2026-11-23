import "server-only";
import {
  conversationCapCents,
  monthlyLimitReached,
  trackTurn,
  withBusinessContext,
  type ConversationRow,
} from "@/lib/baba/conversations";
import { babaConfig, babaUnavailable, getClaude } from "@/lib/baba/server";
import { runTurn } from "@/lib/baba/stream-turn";
import { createTranscript } from "@/lib/baba/transcript";
import type { AppContext } from "@/lib/data/context";
import { serverOrigin } from "@/lib/origin";
import { lastSlot } from "@/lib/schedule";
import { getSupabaseAdmin, isAdminConfigured } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";
import type { ChatItem } from "@/types/chat";

/**
 * Runs scheduled workflows. Called every minute (by the app itself while it's running,
 * and/or by an external scheduler through /api/cron/workflows).
 *
 * - Works out each workflow's latest scheduled time in its workspace's timezone.
 * - "Claims" that time in the database first, so a slot runs once even if two servers check.
 * - Runs that are more than CATCH_UP_MS late (the app was off) are recorded as missed instead.
 */

const CATCH_UP_MS = 3 * 60 * 60 * 1000;

type DueWorkflow = {
  id: string;
  workspace_id: string;
  created_by: string | null;
  name: string;
  instruction: string;
  frequency: string;
  day_of_week: number | null;
  time_of_day: string | null;
  cap_usd: number;
  last_run_slot: string | null;
  created_at: string;
  workspaces: { id: string; name: string; slug: string; timezone: string; task_cap_usd: number; monthly_limit_usd: number; logo_url: string | null } | null;
};

export function schedulerReady() {
  return isAdminConfigured() && babaUnavailable() === null;
}

/** Checks every scheduled workflow once. Returns what it did, plus a promise for when the runs end. */
export async function runDueWorkflows(nowMs = Date.now()) {
  const summary = { checked: 0, started: [] as string[], missed: [] as string[] };
  const runs: Promise<unknown>[] = [];
  const result = () => ({ summary, finished: Promise.allSettled(runs) });
  if (!schedulerReady()) return result();

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("workflows")
    .select(
      "id, workspace_id, created_by, name, instruction, frequency, day_of_week, time_of_day, cap_usd, last_run_slot, created_at, workspaces (id, name, slug, timezone, task_cap_usd, monthly_limit_usd, logo_url)",
    )
    .eq("enabled", true)
    .neq("frequency", "manual");
  if (error) {
    console.error("[workflows] couldn't load workflows:", error.message);
    return result();
  }

  for (const wf of data as DueWorkflow[]) {
    summary.checked++;
    if (!wf.workspaces) continue;
    const slot = lastSlot(
      { frequency: wf.frequency as "daily", dayOfWeek: wf.day_of_week, timeOfDay: wf.time_of_day },
      wf.workspaces.timezone || "UTC",
      nowMs,
    );
    if (slot === null) continue;
    // Already handled, or the workflow was created after this time
    const handledUpTo = Math.max(wf.last_run_slot ? Date.parse(wf.last_run_slot) : 0, Date.parse(wf.created_at));
    if (slot <= handledUpTo) continue;

    // Claim the slot (only one server wins)
    const slotIso = new Date(slot).toISOString();
    const { data: claimed } = await admin
      .from("workflows")
      .update({ last_run_slot: slotIso })
      .eq("id", wf.id)
      .or(`last_run_slot.is.null,last_run_slot.lt."${slotIso}"`)
      .select("id");
    if (!claimed?.length) continue;

    if (nowMs - slot > CATCH_UP_MS) {
      summary.missed.push(wf.name);
      await recordProblem(wf, slotIso, "Missed: Baba wasn't running at the scheduled time. It will run at the next scheduled time.");
      continue;
    }

    summary.started.push(wf.name);
    // Runs in the background; a long task doesn't hold up the others
    runs.push(runWorkflow(wf, slotIso).catch((err) => console.error(`[workflows] "${wf.name}" failed:`, err)));
  }

  if (summary.started.length || summary.missed.length) {
    console.log(`[workflows] started: ${summary.started.join(", ") || "none"}; missed: ${summary.missed.join(", ") || "none"}`);
  }
  // `finished` settles when the started runs end (the in-app timer doesn't wait for it)
  return result();
}

/** Who a scheduled run acts as: the workflow's creator if still a member who can run tasks, else the owner. */
async function runAs(wf: DueWorkflow) {
  const admin = getSupabaseAdmin();
  const { data: members } = await admin
    .from("workspace_members")
    .select("user_id, role")
    .eq("workspace_id", wf.workspace_id);
  const creator = members?.find((m) => m.user_id === wf.created_by && m.role !== "viewer");
  const owner = members?.find((m) => m.role === "owner");
  const member = creator ?? owner;
  if (!member) return null;
  const { data: profile } = await admin.from("profiles").select("id, email, full_name").eq("id", member.user_id).maybeSingle();
  return profile ? { ...profile, role: member.role } : null;
}

function contextFor(wf: DueWorkflow, person: { id: string; email: string; full_name: string; role: AppContext["workspace"]["role"] }): AppContext {
  const ws = wf.workspaces!;
  return {
    // Background job: the secret-key client, always scoped to this workspace below
    supabase: getSupabaseAdmin() as unknown as AppContext["supabase"],
    user: { id: person.id, fullName: person.full_name || person.email, email: person.email },
    workspace: {
      id: ws.id,
      name: ws.name,
      slug: ws.slug,
      role: person.role,
      taskCapUsd: Number(ws.task_cap_usd),
      monthlyLimitUsd: Number(ws.monthly_limit_usd),
      logoUrl: ws.logo_url,
    },
    workspaces: [],
  };
}

/** Records a run that couldn't start, so it shows in Activity. */
async function recordProblem(wf: DueWorkflow, slotIso: string, error: string) {
  await getSupabaseAdmin().from("tasks").insert({
    workspace_id: wf.workspace_id,
    workflow_id: wf.id,
    created_by: wf.created_by,
    request: wf.instruction.slice(0, 2000),
    status: "failed",
    error,
    started_at: slotIso,
    finished_at: new Date().toISOString(),
  });
}

async function runWorkflow(wf: DueWorkflow, slotIso: string) {
  const admin = getSupabaseAdmin();
  const person = await runAs(wf);
  if (!person) return recordProblem(wf, slotIso, "Couldn't run: nobody in the workspace can run tasks.");
  const ctx = contextFor(wf, person);

  if (await monthlyLimitReached(ctx)) {
    return recordProblem(wf, slotIso, "Couldn't run: the workspace reached its monthly spending limit.");
  }

  // The workflow's own cap per run (falls back to the workspace cap if missing)
  const capCents = wf.cap_usd > 0 ? Math.max(1, Math.round(Number(wf.cap_usd) * 100)) : conversationCapCents(ctx);
  const dateLabel = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: wf.workspaces!.timezone }).format(new Date(slotIso));

  // The conversation it runs in (open it from Activity or Ask Baba)
  const conversationId = crypto.randomUUID();
  const { error: convError } = await admin.from("conversations").insert({
    id: conversationId,
    workspace_id: wf.workspace_id,
    created_by: person.id,
    title: `${wf.name} · ${dateLabel}`.slice(0, 120),
    cap_cents: capCents,
  });
  if (convError) return recordProblem(wf, slotIso, `Couldn't start: ${convError.message}`);

  const { data: task, error: taskError } = await admin
    .from("tasks")
    .insert({
      workspace_id: wf.workspace_id,
      conversation_id: conversationId,
      workflow_id: wf.id,
      created_by: person.id,
      request: wf.instruction.slice(0, 2000),
      cap_cents: capCents,
    })
    .select("id")
    .single();
  if (taskError) return recordProblem(wf, slotIso, `Couldn't start: ${taskError.message}`);

  // What you'll see when you open the conversation
  const note: ChatItem = { id: crypto.randomUUID(), type: "text", text: `Scheduled run of the “${wf.name}” workflow.` };
  const userItem: ChatItem = { id: crypto.randomUUID(), type: "user", text: wf.instruction, attachments: [] };
  const transcript = createTranscript(conversationId, note);
  transcript.items.push(userItem);

  const save = async () => {
    if (!transcript.takeChanged()) return;
    const { error } = await admin.from("conversation_items").upsert(
      transcript.items.map((item) => ({
        conversation_id: conversationId,
        workspace_id: wf.workspace_id,
        client_id: item.id,
        type: item.type,
        data: item as unknown as Json,
      })),
      { onConflict: "conversation_id,client_id" },
    );
    if (error) console.error("[workflows] saving the conversation failed:", error.message);
  };
  await save();
  const saver = setInterval(() => void save(), 5000);

  const conversation: ConversationRow = { id: conversationId, workspace_id: wf.workspace_id, claude_session_id: null, cost_cents: 0, paused: false };
  const claude = getClaude();
  const { agentId, environmentId } = babaConfig();

  try {
    await runTurn({
      logName: `workflow:${wf.name}`,
      track: trackTurn(ctx, conversation, task.id, serverOrigin()),
      emit: (event) => transcript.add(event),
      async prepare() {
        const session = await claude.beta.sessions.create({
          agent: agentId!,
          environment_id: environmentId!,
          title: `${wf.name} (scheduled)`.slice(0, 80),
          budget: { type: "limit", max_list_cost: { amount: String(capCents), currency: "USD" } },
          metadata: { workspace_id: wf.workspace_id, conversation_id: conversationId, workflow_id: wf.id },
        });
        await admin.from("conversations").update({ claude_session_id: session.id }).eq("id", conversationId);
        return session.id;
      },
      async kickoff(sessionId) {
        const message = await withBusinessContext(ctx.supabase, wf.workspace_id, wf.instruction);
        await claude.beta.sessions.events.send(sessionId, {
          events: [{ type: "user.message", content: [{ type: "text", text: message }] }],
        });
      },
    });
  } finally {
    clearInterval(saver);
    await save();
  }
}
