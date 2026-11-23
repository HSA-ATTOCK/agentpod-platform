import { canManage, getAppContext } from "@/lib/data/context";
import { disconnectGoogle, setDefaultGoogle } from "@/lib/integrations/google/oauth";

/**
 * POST /api/integrations/google/disconnect — body: { integrationId, action?: "disconnect" | "make_default" }
 * Owners and admins only.
 */
export async function POST(request: Request) {
  const ctx = await getAppContext();
  if (!ctx) return Response.json({ error: "Please sign in again." }, { status: 401 });
  if (!canManage(ctx.workspace.role)) return Response.json({ error: "Only owners and admins can change connections." }, { status: 403 });
  const { integrationId, action } = (await request.json().catch(() => ({}))) as { integrationId?: string; action?: string };
  if (typeof integrationId !== "string") return Response.json({ error: "Missing integrationId." }, { status: 400 });
  try {
    if (action === "make_default") await setDefaultGoogle(ctx.workspace.id, integrationId);
    else await disconnectGoogle(ctx.workspace.id, integrationId);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Couldn't update the connection." }, { status: 400 });
  }
}
