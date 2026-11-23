import { CustomAgentError, deleteCustomAgent, saveCustomAgent } from "@/lib/custom-agents/custom-agents";
import { getAppContext } from "@/lib/data/context";

/**
 * POST   /api/custom-agents — create or update (body: { id?, name, description, instructions, model, webAccess, maxCostUsd, enabled })
 * DELETE /api/custom-agents — body: { id }
 * Owners and admins only.
 */
export async function POST(request: Request) {
  const ctx = await getAppContext();
  if (!ctx) return Response.json({ error: "Please sign in again." }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const text = (key: string) => (typeof body[key] === "string" ? (body[key] as string) : "");
  try {
    const id = await saveCustomAgent(
      ctx,
      {
        name: text("name"),
        description: text("description"),
        instructions: text("instructions"),
        model: text("model") || "claude-sonnet-5-5",
        webAccess: body.webAccess === true,
        maxCostUsd: Number(body.maxCostUsd),
        enabled: body.enabled !== false,
      },
      typeof body.id === "string" && body.id ? body.id : undefined,
    );
    return Response.json({ ok: true, id });
  } catch (error) {
    if (error instanceof CustomAgentError) return Response.json({ error: error.message }, { status: 400 });
    console.error("[custom-agents]", error);
    return Response.json({ error: "Couldn't save the agent on Claude. Please try again." }, { status: 502 });
  }
}

export async function DELETE(request: Request) {
  const ctx = await getAppContext();
  if (!ctx) return Response.json({ error: "Please sign in again." }, { status: 401 });
  const { id } = (await request.json().catch(() => ({}))) as { id?: string };
  try {
    await deleteCustomAgent(ctx, String(id ?? ""));
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Couldn't delete." }, { status: 400 });
  }
}
