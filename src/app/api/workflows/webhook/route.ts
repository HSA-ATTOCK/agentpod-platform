import { randomBytes } from "node:crypto";
import { getAppContext } from "@/lib/data/context";
import { serverOrigin } from "@/lib/origin";
import { audit } from "@/lib/platform/account";
import { hashWebhookToken } from "@/lib/workflows/runner";

/**
 * POST /api/workflows/webhook — body: { workflowId, action: "create" | "remove" }
 * "create" makes (or replaces) the workflow's secret webhook link and returns it ONCE;
 * only a hash is stored. The workflow's creator or a workspace owner/admin.
 */
export async function POST(request: Request) {
  const ctx = await getAppContext();
  if (!ctx) return Response.json({ error: "Please sign in again." }, { status: 401 });
  if (ctx.workspace.role === "viewer") return Response.json({ error: "Viewers can't change workflows." }, { status: 403 });
  const { workflowId, action } = (await request.json().catch(() => ({}))) as { workflowId?: string; action?: string };
  if (typeof workflowId !== "string" || (action !== "create" && action !== "remove")) return Response.json({ error: "Invalid request." }, { status: 400 });

  const token = action === "create" ? randomBytes(24).toString("base64url") : null;
  // Row Level Security only lets the creator or an owner/admin update the workflow
  const { data, error } = await ctx.supabase
    .from("workflows")
    .update({ webhook_token_hash: token ? await hashWebhookToken(token) : null })
    .eq("id", workflowId)
    .eq("workspace_id", ctx.workspace.id)
    .select("id, name");
  if (error) return Response.json({ error: error.message }, { status: 400 });
  if (!data?.length) return Response.json({ error: "Workflow not found, or you can't change it." }, { status: 404 });
  await audit({
    actorId: ctx.user.id,
    actorEmail: ctx.user.email,
    workspaceId: ctx.workspace.id,
    action: token ? "workflow.webhook_created" : "workflow.webhook_removed",
    targetType: "workflow",
    targetId: workflowId,
  });
  return Response.json({ ok: true, url: token ? `${serverOrigin()}/api/hooks/${token}` : null });
}
