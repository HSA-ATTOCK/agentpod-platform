import { canManage, getAppContext } from "@/lib/data/context";
import { deleteDatabase, saveDatabase } from "@/lib/integrations/databases";
import { audit } from "@/lib/platform/account";
import { isAdminConfigured } from "@/lib/supabase/admin";

/**
 * POST   /api/integrations/databases — connect a database from the secure form (tests it first).
 * DELETE /api/integrations/databases — body: { integrationId }
 * Owners and admins only. The password never goes to the chat or to Claude.
 */
async function gate() {
  const ctx = await getAppContext();
  if (!ctx) return { error: Response.json({ error: "Please sign in again." }, { status: 401 }) };
  if (!canManage(ctx.workspace.role)) return { error: Response.json({ error: "Only owners and admins can connect databases." }, { status: 403 }) };
  if (!isAdminConfigured()) return { error: Response.json({ error: "Credentials can't be stored securely on this server yet." }, { status: 503 }) };
  return { ctx };
}

export async function POST(request: Request) {
  const { ctx, error } = await gate();
  if (error) return error;
  const max = ctx.workspace.limits.maxIntegrations;
  if (max !== null) {
    const { count } = await ctx.supabase.from("integrations").select("id", { count: "exact", head: true }).eq("workspace_id", ctx.workspace.id).neq("provider", "google_app");
    if ((count ?? 0) >= max) return Response.json({ error: `Your plan allows ${max} connections. Remove one first.` }, { status: 402 });
  }
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const text = (key: string) => (typeof body[key] === "string" ? (body[key] as string) : "");
  try {
    const id = await saveDatabase({
      workspaceId: ctx.workspace.id,
      userId: ctx.user.id,
      name: text("name"),
      engine: text("engine"),
      host: text("host"),
      port: text("port"),
      database: text("database"),
      user: text("user"),
      password: text("password"),
      ssl: body.ssl !== false,
      sslMode: text("sslMode"),
    });
    await audit({ actorId: ctx.user.id, actorEmail: ctx.user.email, workspaceId: ctx.workspace.id, action: "integration.connected", targetType: "database", targetId: id, details: { name: text("name"), engine: text("engine") } });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Couldn't connect." }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const { ctx, error } = await gate();
  if (error) return error;
  const { integrationId } = (await request.json().catch(() => ({}))) as { integrationId?: string };
  if (typeof integrationId !== "string") return Response.json({ error: "Missing integrationId." }, { status: 400 });
  try {
    await deleteDatabase(ctx.workspace.id, integrationId);
    await audit({ actorId: ctx.user.id, actorEmail: ctx.user.email, workspaceId: ctx.workspace.id, action: "integration.disconnected", targetType: "database", targetId: integrationId });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Couldn't remove it." }, { status: 400 });
  }
}
