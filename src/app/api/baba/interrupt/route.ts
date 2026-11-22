import { babaGate, loadConversation, notFound } from "@/lib/baba/conversations";
import { errorMessage, getClaude } from "@/lib/baba/server";

/** POST /api/baba/interrupt — the Stop button. Body: { conversationId } */
export async function POST(request: Request) {
  const gate = await babaGate({ write: true });
  if (!gate.ok) return gate.response;

  const { conversationId } = (await request.json().catch(() => ({}))) as { conversationId?: string };
  const conversation = await loadConversation(gate.ctx, conversationId);
  if (!conversation?.claude_session_id) return notFound();

  try {
    await getClaude().beta.sessions.events.send(conversation.claude_session_id, { events: [{ type: "user.interrupt" }] });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 502 });
  }
}
