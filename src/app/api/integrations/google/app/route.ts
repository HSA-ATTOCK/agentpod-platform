import { canManage, getAppContext } from "@/lib/data/context";
import { removeGoogleApp, saveGoogleApp } from "@/lib/integrations/google/oauth";
import { isAdminConfigured } from "@/lib/supabase/admin";

/**
 * POST   /api/integrations/google/app — body: { clientId, clientSecret }
 *        Saves the workspace's own Google app (from the secure card in the chat or Integrations).
 *        The secret is encrypted and never shown again, never sent to Claude.
 * DELETE /api/integrations/google/app — removes it (accounts connected with it stop working).
 * Owners and admins only.
 */
async function gate() {
  const ctx = await getAppContext();
  if (!ctx) return { error: Response.json({ error: "Please sign in again." }, { status: 401 }) };
  if (!canManage(ctx.workspace.role)) return { error: Response.json({ error: "Only owners and admins can set this up." }, { status: 403 }) };
  if (!isAdminConfigured()) return { error: Response.json({ error: "This server can't store it securely yet." }, { status: 503 }) };
  return { ctx };
}

export async function POST(request: Request) {
  const { ctx, error } = await gate();
  if (error) return error;
  const { clientId, clientSecret } = (await request.json().catch(() => ({}))) as { clientId?: unknown; clientSecret?: unknown };
  try {
    await saveGoogleApp({
      workspaceId: ctx.workspace.id,
      userId: ctx.user.id,
      clientId: typeof clientId === "string" ? clientId : "",
      clientSecret: typeof clientSecret === "string" ? clientSecret : "",
    });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Couldn't save." }, { status: 400 });
  }
}

export async function DELETE() {
  const { ctx, error } = await gate();
  if (error) return error;
  await removeGoogleApp(ctx.workspace.id);
  return Response.json({ ok: true });
}
