import { babaUnavailable, errorMessage, getClaude, sessionBudgetCents } from "@/lib/baba/server";
import { streamTurn } from "@/lib/baba/stream-turn";

export const maxDuration = 300;

/**
 * POST /api/baba/resume — the "Continue" button on a conversation paused at its spending cap.
 * Body: { sessionId }
 *
 * Raises the session's cap by one more per-conversation amount (BABA_SESSION_BUDGET_USD).
 * Claude keeps the paused session's history and workspace, so the work continues exactly
 * where it stopped — nothing is redone or paid for twice.
 */
export async function POST(request: Request) {
  const unavailable = babaUnavailable();
  if (unavailable) return unavailable;

  const { sessionId } = (await request.json().catch(() => ({}))) as { sessionId?: string };
  if (!sessionId) return Response.json({ error: "Missing sessionId." }, { status: 400 });

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
    newCapCents = Math.ceil(spentCents) + Number(sessionBudgetCents());
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 502 });
  }

  return streamTurn({
    request,
    logName: "baba/resume",
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
