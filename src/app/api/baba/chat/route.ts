import type { BabaChatRequest, BabaStreamEvent } from "@/lib/baba/protocol";
import { babaConfig, babaUnavailable, errorMessage, getClaude, sessionBudgetCents } from "@/lib/baba/server";
import { createTranslator } from "@/lib/baba/translate";

// Long tasks stream for a while. (Vercel caps this by plan; the chat can be resumed later.)
export const maxDuration = 300;

/**
 * POST /api/baba/chat
 * Sends the user's message to Baba and streams progress back as newline-delimited JSON.
 * Creates a Claude session for the conversation on its first message.
 */
export async function POST(request: Request) {
  const unavailable = babaUnavailable();
  if (unavailable) return unavailable;

  let body: BabaChatRequest;
  try {
    body = (await request.json()) as BabaChatRequest;
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return Response.json({ error: "Message is empty." }, { status: 400 });
  if (text.length > 20_000) return Response.json({ error: "Message is too long." }, { status: 413 });

  const claude = getClaude();
  const { agentId, environmentId } = babaConfig();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: BabaStreamEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));

      try {
        // 1. One Claude session per conversation, with a spending cap
        let sessionId = body.sessionId;
        if (!sessionId) {
          const session = await claude.beta.sessions.create({
            agent: agentId!,
            environment_id: environmentId!,
            title: text.slice(0, 80),
            budget: { type: "limit", max_list_cost: { amount: sessionBudgetCents(), currency: "USD" } },
          });
          sessionId = session.id;
        }
        emit({ type: "session", sessionId });

        // 2. Open the event stream BEFORE sending, so no early events are missed
        const events = await claude.beta.sessions.events.stream(sessionId, {}, { signal: request.signal });
        await claude.beta.sessions.events.send(sessionId, {
          events: [{ type: "user.message", content: [{ type: "text", text }] }],
        });

        // 3. Forward translated events until the turn is over
        const translate = createTranslator();
        let finished: BabaStreamEvent | undefined;
        for await (const event of events) {
          const result = translate(event);
          result.out.forEach(emit);
          if (result.finished) {
            finished = result.finished;
            break;
          }
        }

        // 4. Files the agents saved to /mnt/session/outputs/ (indexing can lag a moment)
        if (finished) {
          for (let attempt = 0; attempt < 3; attempt++) {
            const files = await claude.beta.files.list({ scope_id: sessionId, betas: ["managed-agents-2026-04-01"] });
            if (files.data.length > 0) {
              emit({
                type: "files",
                files: files.data.map((f) => ({ id: f.id, name: f.filename, sizeBytes: f.size_bytes })),
              });
              break;
            }
            await new Promise((resolve) => setTimeout(resolve, 1500));
          }
          emit(finished);
        }
      } catch (error) {
        if (!request.signal.aborted) {
          console.error("[baba/chat]", error);
          emit({ type: "error", message: errorMessage(error) });
          emit({ type: "done", reason: "failed" });
        }
      } finally {
        try {
          controller.close();
        } catch {
          // already closed because the browser disconnected
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
