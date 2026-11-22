import type { NextRequest } from "next/server";
import { babaUnavailable, errorMessage, getClaude } from "@/lib/baba/server";

/**
 * GET /api/baba/files/[fileId]?session=sesn_...
 * Downloads a file Baba created. Only files that belong to the given session are served.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/baba/files/[fileId]">) {
  const unavailable = babaUnavailable();
  if (unavailable) return unavailable;

  const { fileId } = await ctx.params;
  const sessionId = request.nextUrl.searchParams.get("session");
  if (!sessionId) return Response.json({ error: "Missing session." }, { status: 400 });

  try {
    const claude = getClaude();
    const files = await claude.beta.files.list({ scope_id: sessionId, betas: ["managed-agents-2026-04-01"] });
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
