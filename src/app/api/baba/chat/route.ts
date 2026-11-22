import type { BabaChatRequest } from "@/lib/baba/protocol";
import { babaConfig, babaUnavailable, getClaude, sessionBudgetCents } from "@/lib/baba/server";
import { streamTurn } from "@/lib/baba/stream-turn";

// Long tasks stream for a while. (Vercel caps this by plan.)
export const maxDuration = 300;

/**
 * POST /api/baba/chat
 * Sends the user's message to Baba and streams progress back as newline-delimited JSON.
 * Creates a Claude session for the conversation on its first message.
 */
export async function POST(request: Request) {
  const unavailable = babaUnavailable();
  if (unavailable) return unavailable;

  let body: BabaChatRequest;
  try {
    body = (await request.json()) as BabaChatRequest;
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return Response.json({ error: "Message is empty." }, { status: 400 });
  if (text.length > 20_000) return Response.json({ error: "Message is too long." }, { status: 413 });

  const claude = getClaude();
  const { agentId, environmentId } = babaConfig();

  return streamTurn({
    request,
    logName: "baba/chat",
    async prepare(emit) {
      // One Claude session per conversation, with a spending cap
      let sessionId = body.sessionId;
      if (!sessionId) {
        const session = await claude.beta.sessions.create({
          agent: agentId!,
          environment_id: environmentId!,
          title: text.slice(0, 80),
          budget: { type: "limit", max_list_cost: { amount: sessionBudgetCents(), currency: "USD" } },
        });
        sessionId = session.id;
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
