import "server-only";
import type { BetaManagedAgentsStreamSessionEvents } from "@anthropic-ai/sdk/resources/beta/sessions/events";
import type { BabaStreamEvent } from "./protocol";

type ToolInput = Record<string, unknown>;

function str(input: ToolInput, key: string) {
  return typeof input[key] === "string" ? (input[key] as string) : "";
}

function fileName(path: string) {
  return path.split("/").filter(Boolean).pop() ?? path;
}

function clip(text: string, max: number) {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > max ? `${oneLine.slice(0, max - 1)}…` : oneLine;
}

/** Short label for the progress list. */
function describeTool(name: string, input: ToolInput): string {
  switch (name) {
    case "web_search":
      return "Searching the web";
    case "web_fetch": {
      try {
        return `Reading ${new URL(str(input, "url")).hostname}`;
      } catch {
        return "Reading a web page";
      }
    }
    case "write":
      return str(input, "file_path") ? `Writing ${fileName(str(input, "file_path"))}` : "Writing a file";
    case "edit":
      return str(input, "file_path") ? `Editing ${fileName(str(input, "file_path"))}` : "Editing a file";
    case "read":
      return str(input, "file_path") ? `Reading ${fileName(str(input, "file_path"))}` : "Reading a file";
    case "bash":
      return "Running code";
    case "glob":
    case "grep":
      return "Looking through files";
    default:
      return `Using ${name.replace(/_/g, " ")}`;
  }
}

/** The extra line shown under a step when "Show details" is open. */
function toolDetail(name: string, input: ToolInput): string | undefined {
  switch (name) {
    case "web_search":
      return str(input, "query") ? `Search: “${clip(str(input, "query"), 160)}”` : undefined;
    case "web_fetch":
      return str(input, "url") ? clip(str(input, "url"), 200) : undefined;
    case "write":
    case "edit":
    case "read":
      return str(input, "file_path") || undefined;
    case "bash":
      return str(input, "command") ? `$ ${clip(str(input, "command"), 200)}` : undefined;
    case "glob":
    case "grep":
      return str(input, "pattern") ? `Pattern: ${clip(str(input, "pattern"), 120)}` : undefined;
    default:
      return clip(JSON.stringify(input), 200);
  }
}

function summarizeInput(input: ToolInput) {
  const text = JSON.stringify(input, null, 2);
  return text.length > 600 ? `${text.slice(0, 600)}…` : text;
}

function resultText(content: { type: string; text?: string }[] | undefined) {
  return (content ?? [])
    .map((block) => (block.type === "text" && block.text ? block.text : ""))
    .join(" ")
    .trim();
}

type TranslateResult = {
  out: BabaStreamEvent[];
  finished?: BabaStreamEvent & { type: "done" };
};

/**
 * Creates a translator for ONE stream. It remembers the tool calls and
 * specialist threads it has seen, so it can mark them done or failed later.
 */
export function createTranslator() {
  // Tool calls on Baba's own thread: tool_use_id -> step shown in the UI
  const toolSteps = new Map<string, { label: string; detail?: string }>();
  // Specialist threads started during this stream
  const specialistThreads = new Set<string>();

  return function translate(event: BetaManagedAgentsStreamSessionEvents): TranslateResult {
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
        // Calls cross-posted from a specialist's thread only show up here when they need approval
        if (!event.session_thread_id) {
          const step = { label: describeTool(event.name, event.input), detail: toolDetail(event.name, event.input) };
          toolSteps.set(event.id, step);
          out.push({ type: "step", id: event.id, ...step, status: "running" });
        }
        if (event.evaluated_permission === "ask") {
          out.push({ type: "approval", toolUseId: event.id, toolName: event.name, summary: summarizeInput(event.input) });
        }
        return { out };
      }

      case "agent.tool_result":
      case "agent.mcp_tool_result": {
        const toolUseId = event.type === "agent.tool_result" ? event.tool_use_id : event.mcp_tool_use_id;
        const step = toolSteps.get(toolUseId);
        if (!step) return { out: [] };
        if (event.is_error) {
          const reason = clip(resultText(event.content), 160);
          return {
            out: [
              {
                type: "step",
                id: toolUseId,
                label: `${step.label} — failed`,
                detail: [step.detail, reason && `Error: ${reason}`].filter(Boolean).join("\n"),
                status: "failed",
              },
            ],
          };
        }
        return { out: [{ type: "step", id: toolUseId, ...step, status: "done" }] };
      }

      case "session.thread_created":
        specialistThreads.add(event.session_thread_id);
        return {
          out: [
            {
              type: "step",
              id: event.session_thread_id,
              label: `${event.agent_name} is working on a sub-task`,
              detail: "Working in its own workspace thread; its report goes back to Baba.",
              agent: event.agent_name,
              status: "running",
            },
          ],
        };

      case "session.thread_status_idle":
      case "session.thread_status_terminated": {
        // Only threads we saw start are specialists (Baba's own thread also reports idle)
        if (!specialistThreads.has(event.session_thread_id)) return { out: [] };
        // A specialist waiting for an approval, or paused at the spending cap, isn't finished yet
        if (
          event.type === "session.thread_status_idle" &&
          (event.stop_reason.type === "requires_action" || event.stop_reason.type === "budget_reached")
        ) {
          return { out: [] };
        }
        return {
          out: [
            {
              type: "step",
              id: event.session_thread_id,
              label: `${event.agent_name} finished its sub-task`,
              detail: "Report sent back to Baba.",
              agent: event.agent_name,
              status: "done",
            },
          ],
        };
      }

      case "session.usage": {
        const cost = event.usage.list_cost?.amount;
        if (cost === undefined) return { out: [] };
        const cap = event.budget?.max_list_cost.amount;
        return { out: [{ type: "usage", costCents: Number(cost), capCents: cap ? Number(cap) : null }] };
      }

      case "session.error":
        return { out: [{ type: "error", message: event.error.message || "Claude reported an error." }] };

      case "session.status_idle": {
        const reason = event.stop_reason.type;
        if (reason === "requires_action") return { out: [] }; // waiting for an approval; keep streaming
        if (reason === "budget_reached") {
          return { out: [], finished: { type: "done", reason: "budget_reached" } };
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
  };
}
