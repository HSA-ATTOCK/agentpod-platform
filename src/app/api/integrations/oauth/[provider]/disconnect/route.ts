import { canManage, getAppContext } from "@/lib/data/context";
import { disconnectOAuth, isOAuthProvider } from "@/lib/integrations/oauth-apps";
import { audit } from "@/lib/platform/account";

/** POST /api/integrations/oauth/<provider>/disconnect — body: { integrationId }. Owners and admins. */
export async function POST(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (!isOAuthProvider(provider)) return Response.json({ error: "Unknown service." }, { status: 404 });
  const ctx = await getAppContext();
  if (!ctx) return Response.json({ error: "Please sign in again." }, { status: 401 });
  if (!canManage(ctx.workspace.role)) return Response.json({ error: "Only owners and admins can disconnect tools." }, { status: 403 });
  const { integrationId } = (await request.json().catch(() => ({}))) as { integrationId?: string };
  try {
    await disconnectOAuth(ctx.workspace.id, String(integrationId ?? ""));
    await audit({ actorId: ctx.user.id, actorEmail: ctx.user.email, workspaceId: ctx.workspace.id, action: "integration.disconnected", targetType: provider, targetId: String(integrationId) });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Couldn't disconnect." }, { status: 400 });
  }
}
