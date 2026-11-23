/**
 * Browser-side helpers for talking to our /api/baba routes.
 * (The Anthropic API key stays on the server; the browser never sees it.)
 */
import type { BabaChatRequest, BabaStreamEvent } from "./protocol";

async function readError(response: Response) {
  try {
    const data = (await response.json()) as { error?: string };
    return data.error ?? `Request failed (${response.status}).`;
  } catch {
    return `Request failed (${response.status}).`;
  }
}

export type StreamOptions = { signal: AbortSignal; onEvent: (event: BabaStreamEvent) => void };

/** Sends a message to Baba and calls onEvent for every progress event until the turn ends. */
export function streamBaba(request: BabaChatRequest, options: StreamOptions) {
  return postAndStream("/api/baba/chat", request, options);
}

/** "Continue" after the spending cap: raises the cap and streams the rest of the same task. */
export function resumeBaba(conversationId: string, options: StreamOptions) {
  return postAndStream("/api/baba/resume", { conversationId }, options);
}

/** Reconnects to a running task after the connection dropped (replays what was missed). */
export function watchBaba(conversationId: string, options: StreamOptions) {
  return postAndStream("/api/baba/watch", { conversationId }, options);
}

async function postAndStream(url: string, payload: unknown, { signal, onEvent }: StreamOptions) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });
  if (!response.ok || !response.body) throw new Error(await readError(response));

  // Newline-delimited JSON: one event per line
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.trim()) onEvent(JSON.parse(line) as BabaStreamEvent);
    }
  }
  if (buffer.trim()) onEvent(JSON.parse(buffer) as BabaStreamEvent);
}

/** Stop button: asks Baba to stop working on the current task. */
export async function interruptBaba(conversationId: string) {
  await fetch("/api/baba/interrupt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversationId }),
  });
}

/** Approve or deny a tool call Baba paused on. */
export async function confirmBabaTool(conversationId: string, toolUseId: string, allow: boolean) {
  const response = await fetch("/api/baba/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversationId, toolUseId, allow }),
  });
  if (!response.ok) throw new Error(await readError(response));
}

export function fileDownloadUrl(fileId: string, conversationId: string) {
  return `/api/baba/files/${encodeURIComponent(fileId)}?conversation=${encodeURIComponent(conversationId)}`;
}

/** Guesses the file kind from its extension, for the icon. */
export function fileKindFromName(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["xlsx", "xls", "csv"].includes(ext)) return "spreadsheet" as const;
  if (["docx", "doc", "pdf", "md", "txt"].includes(ext)) return "document" as const;
  if (["pptx", "ppt"].includes(ext)) return "presentation" as const;
  return "other" as const;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
