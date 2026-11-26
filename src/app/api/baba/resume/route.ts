import { getSupabaseAdmin, isAdminConfigured } from "@/lib/supabase/admin";
import { createCustomToolHandler } from "@/lib/baba/custom-tools";
import {
  babaGate,
  conversationCapCents,
  loadConversation,
  monthlyLimitReached,
  notFound,
  trackTurn,
} from "@/lib/baba/conversations";
import { errorMessage, getClaude } from "@/lib/baba/server";
import { streamTurn } from "@/lib/baba/stream-turn";
import { blockedAgentNames } from "@/lib/platform/limits";

import { appOrigin } from "@/lib/email/mailer";

export const maxDuration = 300;

/**
 * POST /api/baba/resume — the "Continue" button on a conversation paused at its spending cap.
 * Body: { conversationId }
 *
 * Raises the session's cap by one more per-conversation amount (Settings → AI & spending).
 * Claude keeps the paused session's history and workspace, so the work continues exactly
 * where it stopped — nothing is redone or paid for twice.
 */
export async function POST(request: Request) {
  const gate = await babaGate({ write: true });
  if (!gate.ok) return gate.response;
  const { ctx } = gate;

  const { conversationId } = (await request.json().catch(() => ({}))) as { conversationId?: string };
  const conversation = await loadConversation(ctx, conversationId);
  if (!conversation?.claude_session_id) return notFound();
  const sessionId = conversation.claude_session_id;

  const overLimit = await monthlyLimitReached(ctx);
  if (overLimit) return overLimit;

  const claude = getClaude();

  // Work out the new cap before streaming, so problems come back as a normal error
  let newCapCents: number;
  try {
    const session = await claude.beta.sessions.retrieve(sessionId);
    if (session.status === "terminated") {
      return Response.json({ error: "This conversation has ended and can't be continued." }, { status: 409 });
    }
    if (session.status !== "idle") {
      return Response.json({ error: "Baba is still working on this task." }, { status: 409 });
    }
    // The new cap must be above what's been spent so far (which can be a little over the old cap)
    const spentCents = Number(session.usage.list_cost?.amount ?? session.budget?.max_list_cost.amount ?? "0");
    newCapCents = Math.ceil(spentCents) + conversationCapCents(ctx);
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 502 });
  }

  // Mark the paused task as running again
  const db = isAdminConfigured() ? (getSupabaseAdmin() as unknown as typeof ctx.supabase) : ctx.supabase;
  await db.from("conversations").update({ paused: false, cap_cents: newCapCents }).eq("id", conversation.id);
  const { data: task } = await ctx.supabase
    .from("tasks")
    .select("id")
    .eq("conversation_id", conversation.id)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (task) await db.from("tasks").update({ status: "running", cap_cents: newCapCents }).eq("id", task.id);

  const blockedAgents = await blockedAgentNames(ctx.supabase, ctx.workspace.limits);
  return streamTurn({
    request,
    logName: "baba/resume",
    blockedAgents,
    track: trackTurn(ctx, conversation, task?.id, appOrigin(request)),
    customTools: createCustomToolHandler({ workspaceId: conversation.workspace_id, conversationId: conversation.id, ctx }),
    async prepare() {
      return sessionId;
    },
    async kickoff(id) {
      // Raising the budget resumes the paused work automatically
      await claude.beta.sessions.update(id, {
        budget: { type: "limit", max_list_cost: { amount: String(newCapCents), currency: "USD" } },
      });
    },
  });
}
