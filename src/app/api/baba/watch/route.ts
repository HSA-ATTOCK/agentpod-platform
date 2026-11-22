import { babaUnavailable } from "@/lib/baba/server";
import { streamTurn } from "@/lib/baba/stream-turn";

export const maxDuration = 300;

/**
 * POST /api/baba/watch — reconnect to a task after the connection dropped.
 * Body: { sessionId }
 * Replays what Baba did since the last message, then keeps streaming live.
 * Starts no new work and costs nothing extra.
 */
export async function POST(request: Request) {
  const unavailable = babaUnavailable();
  if (unavailable) return unavailable;

  const { sessionId } = (await request.json().catch(() => ({}))) as { sessionId?: string };
  if (!sessionId) return Response.json({ error: "Missing sessionId." }, { status: 400 });

  return streamTurn({
    request,
    logName: "baba/watch",
    catchUp: true,
    async prepare() {
      return sessionId;
    },
  });
}
