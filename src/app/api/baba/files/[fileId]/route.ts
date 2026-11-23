import type { NextRequest } from "next/server";
import { babaGate, loadConversation, notFound } from "@/lib/baba/conversations";
import { errorMessage, getClaude } from "@/lib/baba/server";

/**
 * GET /api/baba/files/[fileId]?conversation=<id>
 * Downloads a file Baba created. Only files from a conversation the user can see are served.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/baba/files/[fileId]">) {
  const gate = await babaGate({ write: false });
  if (!gate.ok) return gate.response;

  const { fileId } = await ctx.params;
  const conversation = await loadConversation(gate.ctx, request.nextUrl.searchParams.get("conversation"));
  if (!conversation?.claude_session_id) return notFound();

  try {
    const claude = getClaude();
    const files = await claude.beta.files.list({
      scope_id: conversation.claude_session_id,
      betas: ["managed-agents-2026-04-01"],
    });
    const file = files.data.find((f) => f.id === fileId);
    if (!file) return Response.json({ error: "File not found." }, { status: 404 });

    const download = await claude.beta.files.download(fileId);
    const safeName = file.filename.replace(/[^\w.\- ]+/g, "_");
    return new Response(download.body, {
      headers: {
        "Content-Type": download.headers.get("content-type") ?? "application/octet-stream",
        "Content-Disposition": `attachment; filename="${safeName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 502 });
  }
}
