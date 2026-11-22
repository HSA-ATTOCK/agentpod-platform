import { babaGate, loadConversation, notFound } from "@/lib/baba/conversations";
import { errorMessage, getClaude } from "@/lib/baba/server";

/**
 * POST /api/baba/confirm — the user's answer to an approval card.
 * Body: { conversationId, toolUseId, allow }
 */
export async function POST(request: Request) {
  const gate = await babaGate({ write: true });
  if (!gate.ok) return gate.response;

  const { conversationId, toolUseId, allow } = (await request.json().catch(() => ({}))) as {
    conversationId?: string;
    toolUseId?: string;
    allow?: boolean;
  };
  if (typeof toolUseId !== "string" || !toolUseId || typeof allow !== "boolean") {
    return Response.json({ error: "Missing toolUseId or allow." }, { status: 400 });
  }
  const conversation = await loadConversation(gate.ctx, conversationId);
  if (!conversation?.claude_session_id) return notFound();

  try {
    await getClaude().beta.sessions.events.send(conversation.claude_session_id, {
      events: [{ type: "user.tool_confirmation", tool_use_id: toolUseId, result: allow ? "allow" : "deny" }],
    });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 502 });
  }
}
