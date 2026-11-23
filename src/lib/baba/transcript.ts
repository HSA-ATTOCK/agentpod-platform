import { fileDownloadUrl, fileKindFromName, formatBytes } from "./client";
import type { BabaStreamEvent } from "./protocol";
import type { ChatItem, TaskStep } from "@/types/chat";

/**
 * Builds the chat items for a run nobody is watching (scheduled workflows), the same way
 * the Ask Baba screen does live, so the conversation looks normal when opened later.
 */
export function createTranscript(conversationId: string, userItem: ChatItem) {
  const progressId = crypto.randomUUID();
  const items: ChatItem[] = [userItem];
  let changed = true;

  function progress() {
    let item = items.find((i) => i.id === progressId);
    if (!item) {
      item = { id: progressId, type: "progress", title: "Working on it", steps: [] };
      items.push(item);
    }
    return item as Extract<ChatItem, { type: "progress" }>;
  }

  return {
    items,
    /** True if items changed since the last call (so they need saving). */
    takeChanged() {
      const was = changed;
      changed = false;
      return was;
    },
    add(event: BabaStreamEvent) {
      switch (event.type) {
        case "step": {
          const p = progress();
          const step: TaskStep = { id: event.id, label: event.label, detail: event.detail, agent: event.agent, status: event.status };
          const at = p.steps.findIndex((s) => s.id === step.id);
          if (at >= 0) p.steps[at] = step;
          else p.steps.push(step);
          break;
        }
        case "message":
          if (!items.some((i) => i.id === event.id)) items.push({ id: event.id, type: "markdown", text: event.text });
          break;
        case "approval":
          if (!items.some((i) => i.type === "tool_approval" && i.toolUseId === event.toolUseId)) {
            items.push({
              id: crypto.randomUUID(),
              type: "tool_approval",
              toolUseId: event.toolUseId,
              toolName: event.toolName,
              summary: event.summary,
              status: "pending",
            });
          }
          break;
        case "files": {
          const known = new Set(items.flatMap((i) => (i.type === "file" ? [i.file.id] : [])));
          for (const f of event.files) {
            if (known.has(f.id)) continue;
            items.push({
              id: `file-${f.id}`,
              type: "file",
              file: {
                id: f.id,
                name: f.name,
                kind: fileKindFromName(f.name),
                sizeLabel: formatBytes(f.sizeBytes),
                downloadUrl: fileDownloadUrl(f.id, conversationId),
              },
            });
          }
          break;
        }
        case "error":
          items.push({ id: crypto.randomUUID(), type: "error", text: event.message });
          break;
        case "connect_request":
          items.push({ id: `connect_request-${event.id}`, type: "connect_request", service: event.service, reason: event.reason, status: "pending" });
          break;
        case "google_app_request":
          items.push({ id: `google_app_request-${event.id}`, type: "google_app_request", redirectUri: event.redirectUri, reason: event.reason, status: "pending" });
          break;
        case "key_request":
          items.push({
            id: `key_request-${event.id}`,
            type: "key_request",
            serviceName: event.serviceName,
            apiHost: event.apiHost,
            headerName: event.headerName,
            headerPrefix: event.headerPrefix,
            queryParam: event.queryParam,
            instructions: event.instructions,
            status: "pending",
          });
          break;
        case "done": {
          const p = items.find((i) => i.id === progressId) as Extract<ChatItem, { type: "progress" }> | undefined;
          if (event.reason === "budget_reached") {
            if (p) {
              p.title = "Paused at spending cap";
              p.steps = p.steps.map((s) => (s.status === "running" ? { ...s, status: "pending" } : s));
            }
            items.push({ id: crypto.randomUUID(), type: "budget_paused", status: "paused" });
          } else if (p) {
            p.title = "Done";
            p.steps = p.steps.map((s) => (s.status === "failed" ? s : { ...s, status: "done" }));
          }
          break;
        }
        default:
          return;
      }
      changed = true;
    },
  };
}
