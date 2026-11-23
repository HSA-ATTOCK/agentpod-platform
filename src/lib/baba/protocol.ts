/**
 * The small, stable event format our server streams to the browser
 * (one JSON object per line). It hides the details of the Claude API
 * so the chat UI only deals with what it needs to show.
 */
export type BabaStreamEvent =
  | { type: "session"; sessionId: string }
  | {
      type: "step";
      id: string;
      label: string;
      detail?: string;
      agent?: string;
      status: "running" | "done" | "failed";
    }
  | { type: "message"; id: string; text: string }
  | { type: "approval"; toolUseId: string; toolName: string; summary: string }
  | { type: "files"; files: { id: string; name: string; sizeBytes: number }[] }
  | { type: "usage"; costCents: number; capCents: number | null }
  | { type: "error"; message: string }
  /** Keep-alive sent every few seconds; the UI ignores it. */
  | { type: "ping" }
  | { type: "done"; reason: "end_turn" | "budget_reached" | "refusal" | "failed" | "terminated" };

/**
 * Body of POST /api/baba/chat. The browser creates the conversation row first
 * (so its messages can be saved); the server looks up its Claude session itself.
 */
export type BabaChatRequest = { conversationId: string; text: string; workflowId?: string };
