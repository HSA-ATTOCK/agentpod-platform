import "server-only";
import type { BabaStreamEvent } from "./protocol";
import { errorMessage, getClaude } from "./server";
import { createTranslator } from "./translate";

type TurnOptions = {
  request: Request;
  /** Label for server logs. */
  logName: string;
  /**
   * Runs first. Returns the Claude session ID to listen to (creating the
   * session if needed). May emit events, e.g. the new session ID.
   */
  prepare: (emit: (event: BabaStreamEvent) => void) => Promise<string>;
  /** Runs right after the event stream is open: send the message, raise the budget, etc. */
  kickoff: (sessionId: string) => Promise<void>;
};

/**
 * Streams one "turn" of a Baba session to the browser as newline-delimited JSON:
 * opens Claude's event stream, starts the work, forwards translated events until
 * the turn ends, then reports any output files.
 */
export function streamTurn({ request, logName, prepare, kickoff }: TurnOptions): Response {
  const claude = getClaude();
  const encoder = new TextEncoder();

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: BabaStreamEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));

      try {
        const sessionId = await prepare(emit);

        // Open the event stream BEFORE starting work, so no early events are missed
        const events = await claude.beta.sessions.events.stream(sessionId, {}, { signal: request.signal });
        await kickoff(sessionId);

        const translate = createTranslator();
        let finished: (BabaStreamEvent & { type: "done" }) | undefined;
        for await (const event of events) {
          const result = translate(event);
          result.out.forEach(emit);
          if (result.finished) {
            finished = result.finished;
            break;
          }
        }

        if (finished) {
          // Files the agents saved to /mnt/session/outputs/ (indexing can lag a moment)
          for (let attempt = 0; attempt < 3; attempt++) {
            const files = await claude.beta.files.list({ scope_id: sessionId, betas: ["managed-agents-2026-04-01"] });
            if (files.data.length > 0) {
              emit({
                type: "files",
                files: files.data.map((f) => ({ id: f.id, name: f.filename, sizeBytes: f.size_bytes })),
              });
              break;
            }
            if (finished.reason === "budget_reached") break; // don't wait on a paused task
            await new Promise((resolve) => setTimeout(resolve, 1500));
          }
          emit(finished);
        }
      } catch (error) {
        if (!request.signal.aborted) {
          console.error(`[${logName}]`, error);
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

  return new Response(body, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
