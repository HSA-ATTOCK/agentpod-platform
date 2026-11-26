import { timingSafeEqual } from "node:crypto";
import { after } from "next/server";
import { runDueWorkflows } from "@/lib/workflows/runner";

export const maxDuration = 300;

/**
 * GET /api/cron/workflows — for an external scheduler (Vercel Cron, Supabase pg_cron…)
 * when the app isn't running all the time. Needs: Authorization: Bearer <CRON_SECRET>.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  const ok = Boolean(secret) && Buffer.byteLength(given) === Buffer.byteLength(secret!) && timingSafeEqual(Buffer.from(given), Buffer.from(secret!));
  if (!ok) return Response.json({ error: "Unauthorized." }, { status: 401 });

  const { summary, finished } = await runDueWorkflows();
  // Keep the server alive until the started runs finish (hosted platforms stop idle functions)
  after(() => finished);
  return Response.json(summary);
}
