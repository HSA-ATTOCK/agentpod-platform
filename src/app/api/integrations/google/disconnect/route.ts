import { canManage, getAppContext } from "@/lib/data/context";
import { disconnectGoogle } from "@/lib/integrations/google/oauth";

/** POST /api/integrations/google/disconnect — removes the workspace's Google connection. */
export async function POST() {
  const ctx = await getAppContext();
  if (!ctx) return Response.json({ error: "Please sign in again." }, { status: 401 });
  if (!canManage(ctx.workspace.role)) return Response.json({ error: "Only owners and admins can disconnect tools." }, { status: 403 });
  try {
    await disconnectGoogle(ctx.workspace.id);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Couldn't disconnect." }, { status: 500 });
  }
}
