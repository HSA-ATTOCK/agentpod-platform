import { babaGate, loadConversation, notFound, trackTurn } from "@/lib/baba/conversations";
import { streamTurn } from "@/lib/baba/stream-turn";
import { appOrigin } from "@/lib/email/mailer";

export const maxDuration = 300;

/**
 * POST /api/baba/watch — reconnect to a task after the connection dropped.
 * Body: { conversationId }
 * Replays what Baba did since the last message, then keeps streaming live.
 * Starts no new work and costs nothing extra.
 */
export async function POST(request: Request) {
  const gate = await babaGate({ write: false });
  if (!gate.ok) return gate.response;
  const { ctx } = gate;

  const { conversationId } = (await request.json().catch(() => ({}))) as { conversationId?: string };
  const conversation = await loadConversation(ctx, conversationId);
  if (!conversation?.claude_session_id) return notFound();
  const sessionId = conversation.claude_session_id;

  return streamTurn({
    request,
    logName: "baba/watch",
    catchUp: true,
    // Viewers may watch, but only people who can write record the result
    track: ctx.workspace.role === "viewer" ? undefined : trackTurn(ctx, conversation, undefined, appOrigin(request)),
    async prepare() {
      return sessionId;
    },
  });
}
