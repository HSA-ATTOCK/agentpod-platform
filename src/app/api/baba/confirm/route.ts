import { babaUnavailable, errorMessage, getClaude } from "@/lib/baba/server";

/**
 * POST /api/baba/confirm — the user's answer to an approval card.
 * Body: { sessionId, toolUseId, allow }
 */
export async function POST(request: Request) {
  const unavailable = babaUnavailable();
  if (unavailable) return unavailable;

  const { sessionId, toolUseId, allow } = (await request.json().catch(() => ({}))) as {
    sessionId?: string;
    toolUseId?: string;
    allow?: boolean;
  };
  if (!sessionId || !toolUseId || typeof allow !== "boolean") {
    return Response.json({ error: "Missing sessionId, toolUseId or allow." }, { status: 400 });
  }

  try {
    await getClaude().beta.sessions.events.send(sessionId, {
      events: [{ type: "user.tool_confirmation", tool_use_id: toolUseId, result: allow ? "allow" : "deny" }],
    });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 502 });
  }
}
