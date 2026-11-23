import { after } from "next/server";
import { runWorkflowFromWebhook } from "@/lib/workflows/runner";

/**
 * POST /api/hooks/<token> — starts the workflow this secret link belongs to.
 * The request body (JSON, form or text, up to 20 KB) is handed to Baba as data.
 * Answers 202 straight away; the run continues in the background and appears in Activity.
 */
const MAX_BODY = 20_000;
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 30;
const hits = new Map<string, number[]>();

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  // Simple per-link rate limit (per server instance)
  const now = Date.now();
  const recent = (hits.get(token) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) return Response.json({ error: "Too many runs from this webhook. Try again later." }, { status: 429 });

  const raw = await request.text().catch(() => "");
  if (raw.length > MAX_BODY) return Response.json({ error: "Body too large (max 20 KB)." }, { status: 413 });
  let payload = raw;
  try {
    payload = JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    // not JSON: pass the text as it is
  }

  const started = await runWorkflowFromWebhook(token, payload || "(empty body)");
  if (!started) return Response.json({ error: "Unknown or disabled webhook." }, { status: 404 });
  recent.push(now);
  hits.set(token, recent);
  after(() => started.run);
  return Response.json({ ok: true, status: "started" }, { status: 202 });
}
