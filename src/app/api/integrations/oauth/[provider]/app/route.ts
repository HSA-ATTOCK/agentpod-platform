import { canManage, getAppContext } from "@/lib/data/context";
import { isOAuthProvider, PROVIDERS, removeOAuthApp, saveOAuthApp } from "@/lib/integrations/oauth-apps";
import { audit } from "@/lib/platform/account";
import { isAdminConfigured } from "@/lib/supabase/admin";

/**
 * POST   /api/integrations/oauth/<provider>/app — save the workspace's app (body: { clientId, clientSecret })
 * DELETE /api/integrations/oauth/<provider>/app — remove it
 * Owners and admins. The secret goes straight to encrypted storage.
 */
async function gate(params: Promise<{ provider: string }>) {
  const { provider } = await params;
  if (!isOAuthProvider(provider)) return { error: Response.json({ error: "Unknown service." }, { status: 404 }) };
  const ctx = await getAppContext();
  if (!ctx) return { error: Response.json({ error: "Please sign in again." }, { status: 401 }) };
  if (!canManage(ctx.workspace.role)) return { error: Response.json({ error: "Only owners and admins can set this up." }, { status: 403 }) };
  if (!isAdminConfigured()) return { error: Response.json({ error: "Secrets can't be stored securely on this server yet." }, { status: 503 }) };
  return { ctx, provider };
}

export async function POST(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const g = await gate(params);
  if (g.error) return g.error;
  const body = (await request.json().catch(() => ({}))) as { clientId?: string; clientSecret?: string };
  try {
    await saveOAuthApp({ workspaceId: g.ctx.workspace.id, userId: g.ctx.user.id, provider: g.provider, clientId: body.clientId ?? "", clientSecret: body.clientSecret ?? "" });
    await audit({ actorId: g.ctx.user.id, actorEmail: g.ctx.user.email, workspaceId: g.ctx.workspace.id, action: "integration.app_saved", targetType: g.provider });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : `Couldn't save the ${PROVIDERS[g.provider].name} app.` }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const g = await gate(params);
  if (g.error) return g.error;
  await removeOAuthApp(g.ctx.workspace.id, g.provider);
  await audit({ actorId: g.ctx.user.id, actorEmail: g.ctx.user.email, workspaceId: g.ctx.workspace.id, action: "integration.app_removed", targetType: g.provider });
  return Response.json({ ok: true });
}
