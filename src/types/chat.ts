/**
 * Ask Baba chat types.
 * A conversation is a list of "items". Each item is one thing shown in the chat:
 * a user message, Baba's progress, an answer, a file, an approval request, etc.
 * When Claude is connected, its streamed events are turned into these items.
 */

export type ChatAttachment = {
  id: string;
  name: string;
  /** e.g. "1.2 MB" */
  sizeLabel?: string;
  /** While in the message box: uploading, ready to send, or failed. */
  status?: "uploading" | "ready" | "failed";
  error?: string;
  /** Set once uploaded (see /api/baba/uploads). */
  upload?: { fileId: string; token: string; mimeType: string };
};

export type TaskStepStatus = "done" | "running" | "pending" | "failed";

export type TaskStep = {
  id: string;
  label: string;
  /** Short line shown when "Show details" is expanded. */
  detail?: string;
  status: TaskStepStatus;
  /** Which agent is doing this step, e.g. "Research Analyst". */
  agent?: string;
};

export type ChatSource = {
  id: string;
  title: string;
  domain: string;
  url: string;
};

export type ChatFileKind = "spreadsheet" | "document" | "presentation" | "other";

export type ChatFile = {
  id: string;
  name: string;
  kind: ChatFileKind;
  sizeLabel: string;
  /** Set for real files Baba created; sample files have none. */
  downloadUrl?: string;
};

/** Formatted pieces of a written answer. */
export type AnswerBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string }
  | { type: "list"; items: { lead?: string; text: string }[] }
  | { type: "table"; columns: string[]; rows: string[][]; highlightRowIndex?: number };

export type ApprovalStatus = "pending" | "approved" | "rejected";

export type ToolId = "web_search" | "code" | "gmail" | "slack" | "files";

export type ChatItem =
  | { id: string; type: "user"; text: string; attachments: ChatAttachment[] }
  | { id: string; type: "progress"; title: string; steps: TaskStep[] }
  | { id: string; type: "sources"; sources: ChatSource[]; totalCount: number }
  | { id: string; type: "answer"; blocks: AnswerBlock[] }
  | { id: string; type: "file"; file: ChatFile }
  | {
      id: string;
      type: "approval";
      action: "send_email";
      to: string;
      subject: string;
      body: string;
      status: ApprovalStatus;
      /** Shown once the approval is approved or rejected. */
      resultText?: string;
    }
  | {
      id: string;
      type: "tool_approval";
      /** Claude's id for the paused tool call. */
      toolUseId: string;
      toolName: string;
      /** What the tool would be called with (shortened JSON). */
      summary: string;
      status: ApprovalStatus;
    }
  | { id: string; type: "error"; text: string; action?: { label: string; href: string } }
  | { id: string; type: "text"; text: string }
  /** A reply from Baba written in Markdown. */
  | { id: string; type: "markdown"; text: string }
  /** A "Connect Google" button Baba put in the chat. */
  | {
      id: string;
      type: "connect_request";
      service: "google";
      reason: string;
      status: "pending" | "connected";
      account?: string;
    }
  /** Secure setup card for the workspace's own Google app, then its Connect button. */
  | {
      id: string;
      type: "google_app_request";
      redirectUri: string;
      reason: string;
      status: "pending" | "saved";
      connectStatus?: "pending" | "connected";
      account?: string;
    }
  /** A secure box for pasting an API key (the key is sent to the server only, never into the chat). */
  | {
      id: string;
      type: "key_request";
      serviceName: string;
      apiHost: string;
      headerName: string;
      headerPrefix: string;
      queryParam: string | null;
      instructions: string;
      status: "pending" | "saved";
    }
  /** A secure form for connecting a database (read-only; the password goes to the server only). */
  | { id: string; type: "db_request"; engine: "postgres" | "mysql"; reason: string; status: "pending" | "saved"; name?: string }
  /** Shown when the conversation hits its spending cap; "Continue" resumes the same task. */
  | { id: string; type: "budget_paused"; status: "paused" | "resumed" };

export type Conversation = {
  id: string;
  title: string;
  /** ISO 8601 */
  updatedAt: string;
  /** True for the built-in example conversations. */
  isSample?: boolean;
  /** The Claude session behind this conversation (real conversations only). */
  sessionId?: string;
  /** Spend so far on this conversation, from Claude's usage reports (US cents). */
  cost?: { cents: number; capCents: number | null };
  /** True while the conversation is paused at its spending cap. */
  paused?: boolean;
  tools: ToolId[];
  items: ChatItem[];
  /** False until the conversation's saved messages have been fetched. */
  loaded?: boolean;
};
