import "server-only";
import type {
  BetaManagedAgentsSessionEvent,
  BetaManagedAgentsStreamSessionEvents,
} from "@anthropic-ai/sdk/resources/beta/sessions/events";
import type { BabaStreamEvent } from "./protocol";
import { errorMessage, getClaude } from "./server";
import { createTranslator } from "./translate";

/** How often to send a keep-alive line, so proxies (Codespaces, Vercel) don't drop a quiet connection. */
const HEARTBEAT_MS = 15_000;

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
  kickoff?: (sessionId: string) => Promise<void>;
  /**
   * Reconnecting after a dropped connection: first replay what already happened
   * in the current turn (since the last user message), then continue live.
   */
  catchUp?: boolean;
};

type Finished = BabaStreamEvent & { type: "done" };

/**
 * Streams one "turn" of a Baba session to the browser as newline-delimited JSON:
 * opens Claude's event stream, starts the work, forwards translated events until
 * the turn ends, then reports any output files.
 */
export function streamTurn({ request, logName, prepare, kickoff, catchUp }: TurnOptions): Response {
  const claude = getClaude();
  const encoder = new TextEncoder();

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const emit = (event: BabaStreamEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          closed = true; // the browser went away; Baba keeps working on Claude's side
        }
      };
      const heartbeat = setInterval(() => emit({ type: "ping" }), HEARTBEAT_MS);

      try {
        const sessionId = await prepare(emit);
        const translate = createTranslator();
        let finished: Finished | undefined;

        // Open the event stream BEFORE anything else, so no events are missed
        const events = await claude.beta.sessions.events.stream(sessionId, {}, { signal: request.signal });

        // Reconnecting: replay this turn's events so far
        const seen = new Set<string>();
        if (catchUp) {
          const history: BetaManagedAgentsSessionEvent[] = [];
          for await (const event of claude.beta.sessions.events.list(sessionId, { order: "asc" })) {
            history.push(event);
          }
          const turnStart = history.findLastIndex((event) => event.type === "user.message");
          for (const event of history.slice(turnStart + 1)) {
            seen.add(event.id);
            const result = translate(event as BetaManagedAgentsStreamSessionEvents);
            result.out.forEach(emit);
            // An earlier pause (e.g. at the budget) that was later resumed doesn't end the turn
            if (result.finished) finished = result.finished;
            else if (event.type === "session.status_running") finished = undefined;
          }
        }

        if (kickoff) await kickoff(sessionId);

        // Live events until the turn is over (skipped if the replay already reached the end)
        if (!finished) {
          for await (const event of events) {
            if ("id" in event && typeof event.id === "string" && seen.has(event.id)) continue;
            const result = translate(event);
            result.out.forEach(emit);
            if (result.finished) {
              finished = result.finished;
              break;
            }
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
        clearInterval(heartbeat);
        closed = true;
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
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
