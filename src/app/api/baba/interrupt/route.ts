import { babaUnavailable, errorMessage, getClaude } from "@/lib/baba/server";

/** POST /api/baba/interrupt — the Stop button. Tells Baba to stop the current task. */
export async function POST(request: Request) {
  const unavailable = babaUnavailable();
  if (unavailable) return unavailable;

  const { sessionId } = (await request.json().catch(() => ({}))) as { sessionId?: string };
  if (!sessionId) return Response.json({ error: "Missing sessionId." }, { status: 400 });

  try {
    await getClaude().beta.sessions.events.send(sessionId, { events: [{ type: "user.interrupt" }] });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 502 });
  }
}
