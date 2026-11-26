import { timingSafeEqual } from "node:crypto";
import { runDueBriefings } from "@/lib/briefing/briefing";

export const maxDuration = 300;

/**
 * GET /api/cron/briefings — sends the daily briefings that are due, for an external
 * scheduler (call it every 5–15 minutes) when the built-in timer is off (BABA_SCHEDULER=off).
 * Needs: Authorization: Bearer <CRON_SECRET>.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  const ok = Boolean(secret) && Buffer.byteLength(given) === Buffer.byteLength(secret!) && timingSafeEqual(Buffer.from(given), Buffer.from(secret!));
  if (!ok) return Response.json({ error: "Unauthorized." }, { status: 401 });
  return Response.json(await runDueBriefings());
}
