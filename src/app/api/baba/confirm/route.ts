import { babaGate, loadConversation, notFound } from "@/lib/baba/conversations";
import { decidePendingTool } from "@/lib/baba/custom-tools";
import { errorMessage, getClaude } from "@/lib/baba/server";

/**
 * POST /api/baba/confirm — the user's answer to an approval card.
 * Body: { conversationId, toolUseId, allow }
 * For connected tools (send email, create event…) this runs the action on approval.
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
    // A pending connected-tool action (send email, create event…)
    const decided = await decidePendingTool({
      workspaceId: conversation.workspace_id,
      conversationId: conversation.id,
      sessionId: conversation.claude_session_id,
      toolUseId,
      allow,
      userId: gate.ctx.user.id,
    });
    if (decided) {
      return decided.ok
        ? Response.json({ ok: true, message: decided.message })
        : Response.json({ error: decided.message }, { status: 409 });
    }

    // Otherwise a built-in tool waiting for permission
    await getClaude().beta.sessions.events.send(conversation.claude_session_id, {
      events: [{ type: "user.tool_confirmation", tool_use_id: toolUseId, result: allow ? "allow" : "deny" }],
    });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 502 });
  }
}
