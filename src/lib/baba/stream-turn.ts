import "server-only";
import type {
  BetaManagedAgentsSessionEvent,
  BetaManagedAgentsStreamSessionEvents,
} from "@anthropic-ai/sdk/resources/beta/sessions/events";
import type { BabaStreamEvent } from "./protocol";
import type { CustomToolHandler } from "./custom-tools";
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
  /** Records the turn in the database (cost, agents, files, how it ended). */
  track?: {
    event: (event: BabaStreamEvent) => void;
    finish: (reason: Finished["reason"]) => Promise<void>;
  };
  /** Runs the custom tools Baba calls (Google…). */
  customTools?: CustomToolHandler;
  /**
   * Nobody is watching (scheduled runs): when a tool call needs a person's approval,
   * stop here and record the task as waiting, instead of waiting on the stream.
   */
  headless?: boolean;
};

type Finished = BabaStreamEvent & { type: "done" };

type RunOptions = Omit<TurnOptions, "request"> & {
  /** Receives every translated event (progress, messages, files, usage, done…). */
  emit: (event: BabaStreamEvent) => void;
  /** Stops listening (the work continues on Claude's side). */
  signal?: AbortSignal;
};

/**
 * Runs one "turn" of a Baba session: opens Claude's event stream, starts the work,
 * passes translated events to `emit` until the turn ends, then reports output files.
 * Used by the browser stream below and by scheduled workflow runs (no browser).
 */
export async function runTurn({ logName, prepare, kickoff, catchUp, track, customTools, headless, emit: rawEmit, signal }: RunOptions) {
  const claude = getClaude();
  const emit = (event: BabaStreamEvent) => {
    if (event.type !== "ping") track?.event(event);
    rawEmit(event);
  };

  try {
    const sessionId = await prepare(emit);
    const translate = createTranslator();
    let finished: Finished | undefined;

    // Open the event stream BEFORE anything else, so no events are missed
    const events = await claude.beta.sessions.events.stream(sessionId, {}, { signal });

    // A custom tool call (Google…): run it, or note that it waits for approval
    let awaitingApproval = false;
    const onCustomTool = async (event: BetaManagedAgentsStreamSessionEvents) => {
      if (event.type !== "agent.custom_tool_use" || !customTools) return;
      const outcome = await customTools(event, sessionId, emit);
      if (outcome === "awaiting_approval") awaitingApproval = true;
    };

    // Reconnecting: replay this turn's events so far
    const seen = new Set<string>();
    if (catchUp) {
      const history: BetaManagedAgentsSessionEvent[] = [];
      for await (const event of claude.beta.sessions.events.list(sessionId, { order: "asc" })) {
        history.push(event);
      }
      const turnStart = history.findLastIndex((event) => event.type === "user.message");
      const turn = history.slice(turnStart + 1);
      // Custom tool calls that already have an answer mustn't run again
      const answered = new Set(
        turn.flatMap((event) => (event.type === "user.custom_tool_result" ? [event.custom_tool_use_id] : [])),
      );
      for (const event of turn) {
        seen.add(event.id);
        const result = translate(event as BetaManagedAgentsStreamSessionEvents);
        result.out.forEach(emit);
        if (event.type === "agent.custom_tool_use" && !answered.has(event.id)) {
          await onCustomTool(event as BetaManagedAgentsStreamSessionEvents);
        }
        // An earlier pause (e.g. at the budget) that was later resumed doesn't end the turn
        if (result.finished) finished = result.finished;
        else if (event.type === "session.status_running") finished = undefined;
      }
      if (headless && awaitingApproval && !finished) finished = { type: "done", reason: "needs_approval" };
    }

    if (kickoff) await kickoff(sessionId);

    // Live events until the turn is over (skipped if the replay already reached the end)
    if (!finished) {
      for await (const event of events) {
        if ("id" in event && typeof event.id === "string" && seen.has(event.id)) continue;
        const result = translate(event);
        result.out.forEach(emit);
        await onCustomTool(event);
        if (result.finished) {
          finished = result.finished;
          break;
        }
        if (headless && awaitingApproval) {
          finished = { type: "done", reason: "needs_approval" };
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
      await track?.finish(finished.reason).catch((error) => console.error(`[${logName}] track`, error));
      emit(finished);
    }
  } catch (error) {
    if (!signal?.aborted) {
      console.error(`[${logName}]`, error);
      emit({ type: "error", message: errorMessage(error) });
      await track?.finish("failed").catch((e) => console.error(`[${logName}] track`, e));
      emit({ type: "done", reason: "failed" });
    }
  }
}

/**
 * Streams one turn to the browser as newline-delimited JSON (see runTurn).
 */
export function streamTurn(turn: TurnOptions): Response {
  // The browser's request isn't used to stop the turn (see below)
  const { request: _browserRequest, ...options } = turn;
  void _browserRequest;
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
        // Not tied to the browser's connection: if the person switches chat or page, the server keeps
        // following the turn to the end (running connected tools, recording cost, files and outcome).
        // The Stop button is what stops a task (it sends an interrupt to Claude).
        await runTurn({ ...options, emit });
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
