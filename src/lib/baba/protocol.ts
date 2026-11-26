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
  /** Baba asks the user to connect a service: show a Connect button in the chat. */
  | { type: "connect_request"; id: string; service: "google" | "slack" | "hubspot" | "microsoft" | "quickbooks" | "xero" | "shopify"; reason: string }
  /** The workspace has no app for this service yet: secure setup card (Client ID + secret), then Connect. */
  | {
      type: "oauth_app_request";
      id: string;
      service: "slack" | "hubspot" | "microsoft" | "quickbooks" | "xero" | "shopify";
      serviceName: string;
      redirectUri: string;
      consoleUrl: string;
      steps: string[];
      reason: string;
    }
  /** The workspace has no Google app yet: show the secure setup card (Client ID + secret). */
  | { type: "google_app_request"; id: string; redirectUri: string; reason: string }
  /** Baba asks for an API key: show a secure box in the chat (the key never goes to Claude). */
  | {
      type: "key_request";
      id: string;
      serviceName: string;
      apiHost: string;
      headerName: string;
      headerPrefix: string;
      queryParam: string | null;
      instructions: string;
    }
  /** Baba asks for a database connection: show the secure form (the password never goes to Claude). */
  | { type: "db_request"; id: string; engine: "postgres" | "mysql"; reason: string }
  | { type: "error"; message: string }
  /** Keep-alive sent every few seconds; the UI ignores it. */
  | { type: "ping" }
  | { type: "done"; reason: "end_turn" | "budget_reached" | "refusal" | "failed" | "terminated" | "needs_approval" };

/**
 * Body of POST /api/baba/chat. The browser creates the conversation row first
 * (so its messages can be saved); the server looks up its Claude session itself.
 */
/** A file uploaded through /api/baba/uploads, as sent along with a message. */
export type BabaAttachment = { fileId: string; token: string; name: string; mimeType: string };

export type BabaChatRequest = {
  conversationId: string;
  text: string;
  workflowId?: string;
  attachments?: BabaAttachment[];
};
