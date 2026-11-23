import { babaGate, loadConversation, notFound, trackTurn } from "@/lib/baba/conversations";
import type { BabaChatRequest } from "@/lib/baba/protocol";
import { babaConfig, getClaude, sessionBudgetCents } from "@/lib/baba/server";
import { streamTurn } from "@/lib/baba/stream-turn";

// Long tasks stream for a while. (Vercel caps this by plan.)
export const maxDuration = 300;

/**
 * POST /api/baba/chat — body: { conversationId, text }
 * Sends the user's message to Baba and streams progress back as newline-delimited JSON.
 * Creates the conversation's Claude session (with its spending cap) on the first message.
 */
export async function POST(request: Request) {
  const gate = await babaGate({ write: true });
  if (!gate.ok) return gate.response;
  const { ctx } = gate;

  let body: BabaChatRequest;
  try {
    body = (await request.json()) as BabaChatRequest;
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return Response.json({ error: "Message is empty." }, { status: 400 });
  if (text.length > 20_000) return Response.json({ error: "Message is too long." }, { status: 413 });

  const conversation = await loadConversation(ctx, body.conversationId);
  if (!conversation) return notFound();
  if (conversation.paused) {
    return Response.json(
      { error: "This conversation is paused at its spending cap. Click Continue to finish the task first." },
      { status: 409 },
    );
  }

  // One row per request, for the Activity page
  const { data: task, error: taskError } = await ctx.supabase
    .from("tasks")
    .insert({
      workspace_id: conversation.workspace_id,
      conversation_id: conversation.id,
      created_by: ctx.user.id,
      request: text.slice(0, 2000),
      cap_cents: Number(sessionBudgetCents()),
    })
    .select("id")
    .single();
  if (taskError) {
    console.error("[baba/chat] task", taskError.message);
    return Response.json({ error: "Couldn't save this task. Please try again." }, { status: 500 });
  }

  const claude = getClaude();
  const { agentId, environmentId } = babaConfig();

  return streamTurn({
    request,
    logName: "baba/chat",
    track: trackTurn(ctx, conversation, task.id),
    async prepare(emit) {
      // One Claude session per conversation, with a spending cap
      let sessionId = conversation.claude_session_id;
      if (!sessionId) {
        const session = await claude.beta.sessions.create({
          agent: agentId!,
          environment_id: environmentId!,
          title: text.slice(0, 80),
          budget: { type: "limit", max_list_cost: { amount: sessionBudgetCents(), currency: "USD" } },
          metadata: { workspace_id: conversation.workspace_id, conversation_id: conversation.id },
        });
        sessionId = session.id;
        const { error } = await ctx.supabase
          .from("conversations")
          .update({ claude_session_id: sessionId, cap_cents: Number(sessionBudgetCents()) })
          .eq("id", conversation.id);
        if (error) throw new Error(`Couldn't link the conversation: ${error.message}`);
      }
      emit({ type: "session", sessionId });
      return sessionId;
    },
    async kickoff(sessionId) {
      await claude.beta.sessions.events.send(sessionId, {
        events: [{ type: "user.message", content: [{ type: "text", text }] }],
      });
    },
  });
}
