import "server-only";
import type { BetaManagedAgentsStreamSessionEvents } from "@anthropic-ai/sdk/resources/beta/sessions/events";
import type { BabaStreamEvent } from "./protocol";

/** Short, readable description of a tool call for the progress list. */
function describeTool(name: string, input: Record<string, unknown>): string {
  const str = (key: string) => (typeof input[key] === "string" ? (input[key] as string) : "");
  const file = (path: string) => path.split("/").filter(Boolean).pop() ?? path;
  switch (name) {
    case "web_search":
      return str("query") ? `Searching the web: “${str("query")}”` : "Searching the web";
    case "web_fetch": {
      try {
        return `Reading ${new URL(str("url")).hostname}`;
      } catch {
        return "Reading a web page";
      }
    }
    case "write":
      return str("file_path") ? `Writing ${file(str("file_path"))}` : "Writing a file";
    case "edit":
      return str("file_path") ? `Editing ${file(str("file_path"))}` : "Editing a file";
    case "read":
      return str("file_path") ? `Reading ${file(str("file_path"))}` : "Reading a file";
    case "bash":
      return "Running code";
    case "glob":
    case "grep":
      return "Looking through files";
    default:
      return `Using ${name.replace(/_/g, " ")}`;
  }
}

function summarizeInput(input: Record<string, unknown>) {
  const text = JSON.stringify(input, null, 2);
  return text.length > 600 ? `${text.slice(0, 600)}…` : text;
}

/**
 * Converts one Claude Managed Agents event into zero or more events for the UI.
 * Returns `finished` when the turn is over and the stream can close.
 */
export function translateEvent(event: BetaManagedAgentsStreamSessionEvents): {
  out: BabaStreamEvent[];
  finished?: BabaStreamEvent & { type: "done" };
} {
  switch (event.type) {
    case "agent.message": {
      const text = event.content
        .map((block) => (block.type === "text" ? block.text : ""))
        .join("")
        .trim();
      return { out: text ? [{ type: "message", id: event.id, text }] : [] };
    }

    case "agent.tool_use":
    case "agent.mcp_tool_use": {
      const out: BabaStreamEvent[] = [];
      // Tool calls cross-posted from a specialist only appear here when they need approval
      if (!event.session_thread_id) {
        out.push({ type: "step", id: event.id, label: describeTool(event.name, event.input), status: "done" });
      }
      if (event.evaluated_permission === "ask") {
        out.push({
          type: "approval",
          toolUseId: event.id,
          toolName: event.name,
          summary: summarizeInput(event.input),
        });
      }
      return { out };
    }

    case "session.thread_created":
      return {
        out: [
          {
            type: "step",
            id: event.session_thread_id,
            label: `${event.agent_name} is working on a sub-task`,
            agent: event.agent_name,
            status: "running",
          },
        ],
      };

    case "session.thread_status_idle":
    case "session.thread_status_terminated":
      // A specialist waiting for an approval isn't finished yet
      if (event.type === "session.thread_status_idle" && event.stop_reason.type === "requires_action") {
        return { out: [] };
      }
      return {
        out: [
          {
            type: "step",
            id: event.session_thread_id,
            label: `${event.agent_name} finished`,
            agent: event.agent_name,
            status: "done",
          },
        ],
      };

    case "session.error":
      return { out: [{ type: "error", message: event.error.message || "Claude reported an error." }] };

    case "session.status_idle": {
      const reason = event.stop_reason.type;
      if (reason === "requires_action") return { out: [] }; // waiting for an approval; keep streaming
      if (reason === "budget_reached") {
        return {
          out: [{ type: "error", message: "This conversation reached its spending cap, so Baba paused." }],
          finished: { type: "done", reason: "budget_reached" },
        };
      }
      if (reason === "refusal") {
        return {
          out: [{ type: "error", message: "Baba declined this request." }],
          finished: { type: "done", reason: "refusal" },
        };
      }
      if (reason === "retries_exhausted") {
        return {
          out: [{ type: "error", message: "Claude couldn't finish after several retries. Please try again." }],
          finished: { type: "done", reason: "failed" },
        };
      }
      return { out: [], finished: { type: "done", reason: "end_turn" } };
    }

    case "session.status_terminated":
      return { out: [], finished: { type: "done", reason: "terminated" } };

    default:
      return { out: [] };
  }
}
