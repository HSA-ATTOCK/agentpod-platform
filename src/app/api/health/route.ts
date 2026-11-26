import { getSupabaseAdmin, isAdminConfigured } from "@/lib/supabase/admin";
import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * GET /api/health — for load balancers and uptime monitors.
 * 200 when the app and the database answer; 503 otherwise. Shows no configuration details.
 */
export async function GET() {
  const started = Date.now();
  let database = false;
  try {
    if (isAdminConfigured()) {
      const { error } = await getSupabaseAdmin().from("platform_settings").select("id").eq("id", 1).single();
      database = !error;
    } else {
      // Without the secret key: a cheap public call that proves the database answers
      const { error } = await (await getSupabaseServer()).auth.getClaims();
      database = !error;
    }
  } catch {
    database = false;
  }
  return Response.json(
    { status: database ? "ok" : "degraded", database, ms: Date.now() - started },
    { status: database ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
