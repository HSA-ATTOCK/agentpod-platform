/**
 * PHASE 1 PLACEHOLDER — Baba is NOT connected to Claude yet.
 *
 * The chat screen calls sendToBaba() for every message. In Phase 2 this becomes
 * a call to our own server route, which talks to the Claude API and streams back
 * chat items (progress steps, answers, files, approval requests…). The chat UI
 * won't need to change: it already renders every ChatItem type.
 */
import type { ChatAttachment, ChatItem } from "@/types/chat";

export const NOT_CONNECTED_MESSAGE =
  "Baba isn't connected to the AI yet. This will be enabled in the next phase.";

type SendInput = {
  conversationId: string;
  text: string;
  attachments: ChatAttachment[];
};

/** Resolves with Baba's reply items. Rejects with an AbortError if stopped. */
export function sendToBaba(input: SendInput, signal: AbortSignal): Promise<ChatItem[]> {
  void input;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      resolve([{ id: crypto.randomUUID(), type: "text", text: NOT_CONNECTED_MESSAGE }]);
    }, 1500);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("Stopped", "AbortError"));
    });
  });
}
