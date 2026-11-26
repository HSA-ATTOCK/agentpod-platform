import { sendBriefing } from "@/lib/briefing/briefing";
import { getAppContext } from "@/lib/data/context";
import { rateLimited, tooManyRequests } from "@/lib/rate-limit";
import { getSupabaseAdmin, isAdminConfigured } from "@/lib/supabase/admin";

/**
 * POST /api/briefing — the signed-in person's daily briefing for the current workspace.
 *   { action: "save", enabled: boolean, hour: 0–23 }  switch it on/off and choose the hour
 *   { action: "send_now" }                             send one straight away (to try it)
 */
export async function POST(request: Request) {
  const ctx = await getAppContext();
  if (!ctx) return Response.json({ error: "Please sign in." }, { status: 401 });
  if (ctx.workspace.role === "viewer") return Response.json({ error: "Viewers can't get the daily briefing in this workspace." }, { status: 403 });
  if (!isAdminConfigured()) return Response.json({ error: "The daily briefing needs the server's secret key (SUPABASE_SECRET_KEY)." }, { status: 503 });
  const body = (await request.json().catch(() => ({}))) as { action?: string; enabled?: unknown; hour?: unknown };
  const db = getSupabaseAdmin();

  if (body.action === "save") {
    const hour = Number(body.hour);
    if (typeof body.enabled !== "boolean" || !Number.isInteger(hour) || hour < 0 || hour > 23) {
      return Response.json({ error: "Choose on or off and an hour between 0 and 23." }, { status: 400 });
    }
    const { error } = await db.from("daily_briefings").upsert(
      { user_id: ctx.user.id, workspace_id: ctx.workspace.id, enabled: body.enabled, send_hour: hour, updated_at: new Date().toISOString() },
      { onConflict: "user_id,workspace_id" },
    );
    if (error) return Response.json({ error: "Couldn't save the briefing setting." }, { status: 500 });
    return Response.json({ ok: true });
  }

  if (body.action === "send_now") {
    const wait = rateLimited(`briefing:${ctx.user.id}`, 3, 10 * 60_000);
    if (wait) return tooManyRequests(wait);
    const result = await sendBriefing(ctx.user.id, ctx.workspace.id);
    return Response.json(result);
  }

  return Response.json({ error: "Unknown action." }, { status: 400 });
}
