import "server-only";
import { emailEnabled, type NotificationPrefs } from "@/config/notifications";
import { routes } from "@/config/routes";
import { getAppContext, type AppContext } from "@/lib/data/context";
import { sendEmail } from "@/lib/email/mailer";
import { taskEmail, type TaskEmailKind } from "@/lib/email/templates";
import { memoryForPrompt } from "@/lib/knowledge/knowledge";
import { getAccount, getPlatformSettings } from "@/lib/platform/account";
import { checkSpendAlerts } from "@/lib/platform/spend-alerts";
import { rateLimited, tooManyRequests } from "@/lib/rate-limit";
import { getSupabaseAdmin, isAdminConfigured } from "@/lib/supabase/admin";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import { fileKindFromName } from "./client";
import type { BabaStreamEvent } from "./protocol";
import { babaUnavailable } from "./server";

/** One step of a task as saved in tasks.steps (shown on the Activity page). */
export type TaskStepRecord = {
  id: string;
  label: string;
  agent?: string;
  status: "running" | "done" | "failed";
  at: string;
};

export type ConversationRow = {
  id: string;
  workspace_id: string;
  claude_session_id: string | null;
  cost_cents: number;
  paused: boolean;
};

type Gate = { ok: true; ctx: AppContext } | { ok: false; response: Response };

/**
 * Checks Baba is set up and the caller is signed in.
 * `write` also requires a role that may start or steer work (not a Viewer).
 */
export async function babaGate({ write }: { write: boolean }): Promise<Gate> {
  const unavailable = babaUnavailable();
  if (unavailable) return { ok: false, response: unavailable };

  const ctx = await getAppContext();
  if (!ctx) {
    const account = await getAccount(await getSupabaseServer());
    if (account && account.status !== "approved") {
      return { ok: false, response: Response.json({ error: "Your account isn't approved yet." }, { status: 403 }) };
    }
    return { ok: false, response: Response.json({ error: "Please sign in again." }, { status: 401 }) };
  }
  // Per person: at most 20 Baba requests a minute and 300 an hour (stops runaway loops and abuse)
  if (write) {
    const wait = rateLimited(`baba:min:${ctx.user.id}`, 20, 60_000) ?? rateLimited(`baba:hour:${ctx.user.id}`, 300, 3_600_000);
    if (wait) return { ok: false, response: tooManyRequests(wait) };
  }
  const settings = await getPlatformSettings(ctx.supabase);
  if (settings?.maintenanceMode && !ctx.isPlatformAdmin) {
    return { ok: false, response: Response.json({ error: settings.maintenanceMessage }, { status: 503 }) };
  }
  if (write && ctx.workspace.role === "viewer") {
    return {
      ok: false,
      response: Response.json({ error: "Viewers can't give Baba tasks. Ask an admin for Member access." }, { status: 403 }),
    };
  }
  return { ok: true, ctx };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Loads a conversation the signed-in user can see (RLS hides everyone else's).
 * This is what ties a browser request to a Claude session: the browser never
 * names a session itself, so it can't reach another business's work.
 */
export async function loadConversation(ctx: AppContext, conversationId: unknown) {
  if (typeof conversationId !== "string" || !UUID.test(conversationId)) return null;
  const { data } = await ctx.supabase
    .from("conversations")
    .select("id, workspace_id, claude_session_id, cost_cents, paused")
    .eq("id", conversationId)
    // Only conversations in the workspace whose role and limits were just checked
    .eq("workspace_id", ctx.workspace.id)
    .maybeSingle();
  return data satisfies ConversationRow | null;
}

export function notFound() {
  return Response.json({ error: "Conversation not found." }, { status: 404 });
}

const STATUS_FOR: Record<
  Extract<BabaStreamEvent, { type: "done" }>["reason"],
  "succeeded" | "failed" | "paused" | "needs_approval"
> = {
  needs_approval: "needs_approval",
  end_turn: "succeeded",
  budget_reached: "paused",
  refusal: "failed",
  failed: "failed",
  terminated: "failed",
};

/**
 * Records a turn in the database as it streams: spend, which agents helped,
 * the files Baba created, and how the task ended (for the Activity and Projects pages).
 */
/**
 * Emails the person who started the task, if their notification choices allow it
 * (Settings → Notifications).
 */
async function notify(ctx: AppContext, kind: TaskEmailKind, request: string, url: string, detail?: string) {
  const { data } = await ctx.supabase
    .from("notification_preferences")
    .select("prefs")
    .eq("user_id", ctx.user.id)
    .eq("workspace_id", ctx.workspace.id)
    .maybeSingle();
  if (!emailEnabled((data?.prefs ?? {}) as NotificationPrefs, kind)) return;
  await sendEmail(taskEmail({ to: ctx.user.email, kind, request, url, detail }));
}

const EMAIL_FOR: Partial<Record<"succeeded" | "failed" | "paused" | "needs_approval", TaskEmailKind>> = {
  succeeded: "task_finished",
  failed: "task_failed",
  paused: "paused_at_cap",
};

/** `origin` is the app's address, for links in notification emails. */
export function trackTurn(ctx: AppContext, conversation: ConversationRow, taskId?: string, origin?: string) {
  // Spending and status are written by the server: users can't change them through the API
  const supabase = isAdminConfigured() ? (getSupabaseAdmin() as unknown as AppContext["supabase"]) : ctx.supabase;
  const chatUrl = origin ? `${origin}${routes.ask}?c=${conversation.id}` : null;
  const approvalsEmailed = new Set<string>();
  let costCents: number | undefined;
  let capCents: number | null | undefined;
  let lastError: string | undefined;
  const agents = new Set<string>();
  // Steps for the Activity page, in the order they started
  const steps = new Map<string, TaskStepRecord>();

  async function currentTaskId() {
    if (taskId) return taskId;
    const { data } = await supabase
      .from("tasks")
      .select("id")
      .eq("conversation_id", conversation.id)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    taskId = data?.id;
    return taskId;
  }

  async function saveFiles(files: Extract<BabaStreamEvent, { type: "files" }>["files"]) {
    const task = await currentTaskId();
    const { error } = await supabase.from("files").upsert(
      files.map((f) => ({
        workspace_id: conversation.workspace_id,
        conversation_id: conversation.id,
        task_id: task ?? null,
        claude_file_id: f.id,
        name: f.name,
        kind: fileKindFromName(f.name),
        size_bytes: f.sizeBytes,
      })),
      { onConflict: "workspace_id,claude_file_id", ignoreDuplicates: true },
    );
    if (error) console.error("[baba/track] files", error.message);
  }

  return {
    event(event: BabaStreamEvent) {
      if (event.type === "usage") {
        costCents = event.costCents;
        capCents = event.capCents;
      } else if (event.type === "step") {
        if (event.agent) agents.add(event.agent);
        steps.set(event.id, {
          id: event.id,
          label: event.label,
          agent: event.agent,
          status: event.status,
          at: steps.get(event.id)?.at ?? new Date().toISOString(),
        });
      } else if (event.type === "error") {
        lastError = event.message;
      } else if (event.type === "files") {
        void saveFiles(event.files);
      } else if (event.type === "approval" && chatUrl && !approvalsEmailed.has(event.toolUseId)) {
        approvalsEmailed.add(event.toolUseId);
        void (async () => {
          const id = await currentTaskId();
          const { data } = id ? await supabase.from("tasks").select("request").eq("id", id).maybeSingle() : { data: null };
          await notify(ctx, "approval_needed", data?.request ?? conversation.id, chatUrl, `Baba wants to use: ${event.toolName}`);
        })().catch((error) => console.error("[baba/track] approval email", error));
      }
    },

    async finish(reason: Extract<BabaStreamEvent, { type: "done" }>["reason"]) {
      const status = STATUS_FOR[reason];
      const task = await currentTaskId();
      const spent = costCents !== undefined ? Math.max(0, Math.round(costCents)) : undefined;

      const conversationUpdate = supabase
        .from("conversations")
        .update({
          paused: status === "paused",
          ...(spent !== undefined ? { cost_cents: spent } : {}),
          ...(capCents ? { cap_cents: Math.round(capCents) } : {}),
        })
        .eq("id", conversation.id);

      let taskUpdate: PromiseLike<unknown> = Promise.resolve();
      let previous: { status: string; request: string } | null = null;
      if (task) {
        const { data: existing } = await supabase
          .from("tasks")
          .select("cost_cents, agents, steps, status, request")
          .eq("id", task)
          .maybeSingle();
        previous = existing ? { status: existing.status, request: existing.request } : null;
        // Merge with steps saved earlier (a task resumed after its cap keeps its first steps)
        const merged = new Map<string, TaskStepRecord>(
          ((existing?.steps as TaskStepRecord[] | null) ?? []).map((step) => [step.id, step]),
        );
        for (const step of steps.values()) {
          merged.set(step.id, {
            ...step,
            at: merged.get(step.id)?.at ?? step.at,
            // Anything still "running" when the turn ends didn't finish
            status:
              step.status === "running"
                ? status === "succeeded"
                  ? "done"
                  : status === "paused" || status === "needs_approval"
                    ? "running"
                    : "failed"
                : step.status,
          });
        }
        // The session's spend is cumulative; this turn added (now − what the conversation had before)
        const added = spent !== undefined ? Math.max(0, spent - conversation.cost_cents) : 0;
        taskUpdate = supabase
          .from("tasks")
          .update({
            status,
            cost_cents: (existing?.cost_cents ?? 0) + added,
            agents: [...new Set([...(existing?.agents ?? []), ...agents])],
            steps: [...merged.values()].slice(-100) as unknown as Json,
            error: status === "failed" ? (lastError ?? "The task didn't finish.") : null,
            finished_at: status === "paused" || status === "needs_approval" ? null : new Date().toISOString(),
            ...(capCents ? { cap_cents: Math.round(capCents) } : {}),
          })
          .eq("id", task);
      }

      const [conv, tsk] = await Promise.all([conversationUpdate, taskUpdate]);
      for (const result of [conv, tsk] as { error?: { message: string } | null }[]) {
        if (result?.error) console.error("[baba/track]", result.error.message);
      }
      if (spent !== undefined) conversation.cost_cents = spent;
      if (spent !== undefined) await checkSpendAlerts(ctx);

      // Email once per change of outcome (a reconnect replaying the same ending sends nothing)
      const kind = EMAIL_FOR[status];
      if (kind && chatUrl && previous && previous.status !== status) {
        await notify(ctx, kind, previous.request, chatUrl, status === "failed" ? (lastError ?? undefined) : undefined).catch((error) =>
          console.error("[baba/track] email", error),
        );
      }
    },
  };
}

/** Spending cap for one conversation, from the workspace's AI & spending settings. */
export function conversationCapCents(ctx: AppContext) {
  return Math.max(1, Math.round(ctx.workspace.taskCapUsd * 100));
}

/** What the workspace has spent on Baba since the start of this month (UTC), in cents. */
export async function monthlySpendCents(ctx: AppContext) {
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const { data } = await ctx.supabase
    .from("tasks")
    .select("cost_cents")
    .eq("workspace_id", ctx.workspace.id)
    .gte("started_at", start.toISOString());
  return (data ?? []).reduce((sum, row) => sum + row.cost_cents, 0);
}

/** Returns an error Response when the workspace has used up its monthly limit. */
export async function monthlyLimitReached(ctx: AppContext): Promise<Response | null> {
  // Daily limit from the platform administrator (plan or override)
  if (ctx.workspace.dailyLimitUsd !== null) {
    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);
    const { data } = await ctx.supabase
      .from("tasks")
      .select("cost_cents")
      .eq("workspace_id", ctx.workspace.id)
      .gte("started_at", dayStart.toISOString());
    const today = (data ?? []).reduce((sum, row) => sum + row.cost_cents, 0);
    const dailyLimit = Math.round(ctx.workspace.dailyLimitUsd * 100);
    if (today >= dailyLimit) {
      return Response.json(
        { error: `This workspace has reached its daily spending limit ($${(dailyLimit / 100).toFixed(2)}). It resets at midnight UTC.` },
        { status: 402 },
      );
    }
  }
  const spent = await monthlySpendCents(ctx);
  const limit = Math.round(ctx.workspace.monthlyLimitUsd * 100);
  if (spent < limit) return null;
  const dollars = "$" + (limit / 100).toFixed(2);
  return Response.json(
    {
      error: `This workspace has reached its monthly spending limit (${dollars}). An owner or admin can raise it in Settings → AI & spending.`,
    },
    { status: 402 },
  );
}

/** Puts the workspace's "About your business" notes in front of the first message of a conversation. */
export async function withBusinessContext(supabase: AppContext["supabase"], workspaceId: string, text: string) {
  const [{ data: ws }, memory, { data: custom }] = await Promise.all([
    supabase.from("workspaces").select("name, business_context").eq("id", workspaceId).maybeSingle(),
    memoryForPrompt(supabase, workspaceId),
    supabase.from("custom_agents").select("name, description").eq("workspace_id", workspaceId).eq("enabled", true).order("name"),
  ]);
  const parts: string[] = [];
  if (ws?.business_context.trim()) parts.push(`About my business (${ws.name}), from my Baba settings:\n${ws.business_context.trim()}`);
  if (memory) parts.push(`Business memory (reuse this instead of asking again; "unconfirmed" items are Baba's suggestions, not verified facts):\n${memory}`);
  if (custom?.length) {
    parts.push(`My custom agents (use run_custom_agent when a task fits one):\n${custom.map((a) => `- ${a.name}: ${a.description || "no description"}`).join("\n")}`);
  }
  return parts.length ? `${parts.join("\n\n")}\n\n---\n\n${text}` : text;
}
