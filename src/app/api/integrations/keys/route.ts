import { canManage, getAppContext } from "@/lib/data/context";
import { deleteConnection, saveApiKey } from "@/lib/integrations/connections";
import { isAdminConfigured } from "@/lib/supabase/admin";

/**
 * POST   /api/integrations/keys — save an API key from the secure box (never goes into the chat or to Claude).
 *        body: { serviceName, apiHost, headerName?, headerPrefix?, queryParam?, key }
 * DELETE /api/integrations/keys — body: { integrationId }
 * Owners and admins only.
 */
async function gate() {
  const ctx = await getAppContext();
  if (!ctx) return { error: Response.json({ error: "Please sign in again." }, { status: 401 }) };
  if (!canManage(ctx.workspace.role)) {
    return { error: Response.json({ error: "Only owners and admins can add or remove keys." }, { status: 403 }) };
  }
  if (!isAdminConfigured()) return { error: Response.json({ error: "Keys can't be stored securely on this server yet." }, { status: 503 }) };
  return { ctx };
}

export async function POST(request: Request) {
  const { ctx, error } = await gate();
  if (error) return error;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const text = (key: string) => (typeof body[key] === "string" ? (body[key] as string) : undefined);
  try {
    await saveApiKey({
      workspaceId: ctx.workspace.id,
      userId: ctx.user.id,
      serviceName: text("serviceName") ?? "",
      host: text("apiHost") ?? "",
      header: text("headerName"),
      prefix: text("headerPrefix"),
      queryParam: text("queryParam") ?? null,
      key: text("key") ?? "",
    });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Couldn't save the key." }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const { ctx, error } = await gate();
  if (error) return error;
  const { integrationId } = (await request.json().catch(() => ({}))) as { integrationId?: string };
  if (typeof integrationId !== "string") return Response.json({ error: "Missing integrationId." }, { status: 400 });
  try {
    await deleteConnection(ctx.workspace.id, integrationId);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Couldn't remove the key." }, { status: 400 });
  }
}
