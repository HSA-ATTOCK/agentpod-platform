import { getAppContext } from "@/lib/data/context";
import { deleteMemory, saveMemory } from "@/lib/knowledge/knowledge";

/**
 * POST   /api/memory — body: { category, content, id? } (add, edit or confirm an entry)
 * DELETE /api/memory — body: { id }
 * Members who can give Baba tasks (not viewers). Row Level Security checks it again.
 */
async function gate() {
  const ctx = await getAppContext();
  if (!ctx) return { error: Response.json({ error: "Please sign in again." }, { status: 401 }) };
  if (ctx.workspace.role === "viewer") return { error: Response.json({ error: "Viewers can't change memory." }, { status: 403 }) };
  return { ctx };
}

export async function POST(request: Request) {
  const { ctx, error } = await gate();
  if (error) return error;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const id = await saveMemory(ctx, {
      category: typeof body.category === "string" ? body.category : "fact",
      content: typeof body.content === "string" ? body.content : "",
      source: "user",
      id: typeof body.id === "string" ? body.id : undefined,
    });
    return Response.json({ ok: true, id });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Couldn't save." }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const { ctx, error } = await gate();
  if (error) return error;
  const { id } = (await request.json().catch(() => ({}))) as { id?: string };
  try {
    await deleteMemory(ctx, String(id ?? ""));
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Couldn't delete." }, { status: 400 });
  }
}
