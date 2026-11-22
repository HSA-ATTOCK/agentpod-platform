"use client";

import { X } from "lucide-react";
import { useRef, useState } from "react";
import { Sheet } from "@/components/ui/sheet";
import {
  confirmBabaTool,
  fileDownloadUrl,
  fileKindFromName,
  formatBytes,
  interruptBaba,
  resumeBaba,
  streamBaba,
  watchBaba,
  type StreamOptions,
} from "@/lib/baba/client";
import type { BabaStreamEvent } from "@/lib/baba/protocol";
import { sampleConversations } from "@/lib/sample-chat";
import type { ChatAttachment, ChatItem, Conversation } from "@/types/chat";
import { ChatHeader } from "./chat-header";
import { Composer } from "./composer";
import { ConversationList } from "./conversation-list";
import { MessageList } from "./message-list";
import { NewChat } from "./new-chat";
import { TaskDetails } from "./task-details";

// How many times to reconnect automatically if the connection drops mid-task
const MAX_RECONNECTS = 5;

// The Task details panel sits beside the chat from this width; below it, it opens as a sheet.
const WIDE_SCREEN_QUERY = "(min-width: 1280px)";

function titleFrom(text: string, attachments: ChatAttachment[]) {
  const source = text || attachments[0]?.name || "New chat";
  return source.length > 48 ? `${source.slice(0, 47)}…` : source;
}

/**
 * The Ask Baba screen. Holds the conversations and the chat state on the client.
 * Messages go to our /api/baba routes, which talk to Claude Managed Agents.
 * Conversations live in memory only for now (no database yet), so they reset on reload.
 */
export function AskBaba() {
  const [conversations, setConversations] = useState<Conversation[]>(sampleConversations);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [working, setWorking] = useState(false);

  const [taskPanelOpen, setTaskPanelOpen] = useState(true); // wide screens
  const [taskSheetOpen, setTaskSheetOpen] = useState(false); // small screens
  const [conversationsSheetOpen, setConversationsSheetOpen] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const runningSessionRef = useRef<string | undefined>(undefined);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const active = conversations.find((c) => c.id === activeId) ?? null;

  // ---- Conversation helpers ----

  function updateConversation(id: string, update: (c: Conversation) => Conversation) {
    setConversations((prev) => prev.map((c) => (c.id === id ? update(c) : c)));
  }

  function appendItems(id: string, items: ChatItem[]) {
    updateConversation(id, (c) => ({ ...c, items: [...c.items, ...items], updatedAt: new Date().toISOString() }));
  }

  function updateItem(itemId: string, patch: Partial<ChatItem>) {
    if (!activeId) return;
    updateConversation(activeId, (c) => ({
      ...c,
      items: c.items.map((item) => (item.id === itemId ? ({ ...item, ...patch } as ChatItem) : item)),
    }));
  }

  function stop() {
    const controller = abortRef.current;
    if (controller) {
      // Tell Claude to stop the task, then stop listening
      if (runningSessionRef.current) void interruptBaba(runningSessionRef.current);
      controller.abort();
    }
    abortRef.current = null;
    setWorking(false);
  }

  // ---- Talking to Baba ----

  /** Adds or updates a step in this turn's progress block. */
  function upsertStep(conversationId: string, progressId: string, event: Extract<BabaStreamEvent, { type: "step" }>) {
    updateConversation(conversationId, (c) => {
      const step = { id: event.id, label: event.label, detail: event.detail, agent: event.agent, status: event.status };
      const exists = c.items.some((i) => i.id === progressId);
      const items: ChatItem[] = exists
        ? c.items.map((i) => {
            if (i.id !== progressId || i.type !== "progress") return i;
            const has = i.steps.some((st) => st.id === step.id);
            return { ...i, steps: has ? i.steps.map((st) => (st.id === step.id ? step : st)) : [...i.steps, step] };
          })
        : [...c.items, { id: progressId, type: "progress", title: "Working on it", steps: [step] }];
      return { ...c, items };
    });
  }

  /** Marks this turn's progress block as finished. */
  function finishProgress(conversationId: string, progressId: string) {
    updateConversation(conversationId, (c) => ({
      ...c,
      items: c.items.map((i) =>
        i.id === progressId && i.type === "progress"
          ? {
              ...i,
              title: "Done",
              steps: i.steps.map((st) => (st.status === "failed" ? st : { ...st, status: "done" as const })),
            }
          : i,
      ),
    }));
  }

  /** Marks this turn's progress block as paused at the spending cap. */
  function pauseProgress(conversationId: string, progressId: string) {
    updateConversation(conversationId, (c) => ({
      ...c,
      paused: true,
      items: [
        ...c.items.map((i) =>
          i.id === progressId && i.type === "progress"
            ? {
                ...i,
                title: "Paused at spending cap",
                steps: i.steps.map((st) => (st.status === "running" ? { ...st, status: "pending" as const } : st)),
              }
            : i,
        ),
        { id: crypto.randomUUID(), type: "budget_paused", status: "paused" },
      ],
    }));
  }

  /**
   * Runs one turn of Baba and shows its progress.
   * `open` starts the request: a new message, or "Continue" after the spending cap.
   */
  async function runBaba(
    conversationId: string,
    sessionId: string | undefined,
    open: (sessionId: string | undefined, options: StreamOptions) => Promise<void>,
    /** Continue an existing progress block (after "Continue") instead of starting a new one. */
    existingProgressId?: string,
  ) {
    const controller = new AbortController();
    abortRef.current = controller;
    runningSessionRef.current = sessionId;
    setWorking(true);
    const progressId = existingProgressId ?? crypto.randomUUID();
    let currentSessionId = sessionId;
    let pausedAtCap = false;
    let gotDone = false;
    // Approvals already shown in this chat (a reconnect replays them)
    const seenApprovals = new Set(
      (conversations.find((c) => c.id === conversationId)?.items ?? []).flatMap((i) =>
        i.type === "tool_approval" ? [i.toolUseId] : [],
      ),
    );

    function handle(event: BabaStreamEvent) {
      switch (event.type) {
        case "session":
          currentSessionId = event.sessionId;
          runningSessionRef.current = event.sessionId;
          updateConversation(conversationId, (c) => ({ ...c, sessionId: event.sessionId }));
          break;
        case "step":
          upsertStep(conversationId, progressId, event);
          break;
        case "message":
          // Replays after a reconnect can repeat events, so skip ones already shown
          updateConversation(conversationId, (c) =>
            c.items.some((i) => i.id === event.id)
              ? c
              : { ...c, items: [...c.items, { id: event.id, type: "markdown", text: event.text }] },
          );
          break;
        case "approval":
          if (seenApprovals.has(event.toolUseId)) break;
          seenApprovals.add(event.toolUseId);
          appendItems(conversationId, [
            {
              id: crypto.randomUUID(),
              type: "tool_approval",
              toolUseId: event.toolUseId,
              toolName: event.toolName,
              summary: event.summary,
              status: "pending",
            },
          ]);
          break;
        case "files":
          updateConversation(conversationId, (c) => {
            const known = new Set(c.items.flatMap((i) => (i.type === "file" ? [i.file.id] : [])));
            const added: ChatItem[] = event.files
              .filter((f) => !known.has(f.id))
              .map((f) => ({
                id: `file-${f.id}`,
                type: "file",
                file: {
                  id: f.id,
                  name: f.name,
                  kind: fileKindFromName(f.name),
                  sizeLabel: formatBytes(f.sizeBytes),
                  downloadUrl: currentSessionId ? fileDownloadUrl(f.id, currentSessionId) : undefined,
                },
              }));
            return { ...c, items: [...c.items, ...added] };
          });
          break;
        case "usage":
          updateConversation(conversationId, (c) => ({
            ...c,
            cost: { cents: event.costCents, capCents: event.capCents },
          }));
          break;
        case "error":
          appendItems(conversationId, [{ id: crypto.randomUUID(), type: "error", text: event.message }]);
          break;
        case "done":
          gotDone = true;
          if (event.reason === "budget_reached") pausedAtCap = true;
          else finishProgress(conversationId, progressId);
          break;
      }
    }

    const isAbort = (error: unknown) => error instanceof DOMException && error.name === "AbortError";
    const options = { signal: controller.signal, onEvent: handle };

    try {
      let lastError: unknown;
      try {
        await open(sessionId, options);
      } catch (error) {
        if (isAbort(error)) throw error;
        lastError = error;
      }

      // The connection dropped before the task finished (proxy or time limit):
      // reconnect and catch up. Baba keeps working on Claude's side meanwhile.
      for (let attempt = 1; !gotDone && currentSessionId && attempt <= MAX_RECONNECTS; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
        if (controller.signal.aborted) break;
        try {
          lastError = undefined;
          await watchBaba(currentSessionId, options);
        } catch (error) {
          if (isAbort(error)) throw error;
          lastError = error;
        }
      }

      if (!gotDone && !controller.signal.aborted) {
        const message =
          lastError instanceof Error && !/network|fetch|protocol/i.test(lastError.message)
            ? lastError.message
            : "Lost the connection to Baba. It may still be working; try sending a short follow-up in a minute.";
        appendItems(conversationId, [{ id: crypto.randomUUID(), type: "error", text: message }]);
      }
    } catch (error) {
      if (!isAbort(error)) {
        appendItems(conversationId, [
          {
            id: crypto.randomUUID(),
            type: "error",
            text: error instanceof Error ? error.message : "Something went wrong. Please try again.",
          },
        ]);
      }
    } finally {
      if (pausedAtCap) pauseProgress(conversationId, progressId);
      else finishProgress(conversationId, progressId);
      if (abortRef.current === controller) {
        abortRef.current = null;
        setWorking(false);
      }
    }
  }

  function send(text: string, attachments: ChatAttachment[]) {
    const userItem: ChatItem = { id: crypto.randomUUID(), type: "user", text, attachments };
    const notes: ChatItem[] =
      attachments.length > 0
        ? [
            {
              id: crypto.randomUUID(),
              type: "error",
              text: text
                ? "Attached files can't be sent to Baba yet, so only your message text was sent."
                : "Attached files can't be sent to Baba yet. Please describe the task in text.",
            },
          ]
        : [];
    let conversationId = activeId;

    // A paused conversation only accepts "Continue" until its cap is raised
    if (active?.paused) {
      appendItems(active.id, [
        {
          id: crypto.randomUUID(),
          type: "error",
          text: "This conversation is paused at its spending cap. Click Continue above to finish the task, or start a new chat.",
        },
      ]);
      return;
    }

    if (!conversationId) {
      conversationId = crypto.randomUUID();
      const conversation: Conversation = {
        id: conversationId,
        title: titleFrom(text, attachments),
        updatedAt: new Date().toISOString(),
        tools: [],
        items: [userItem, ...notes],
      };
      setConversations((prev) => [conversation, ...prev]);
      setActiveId(conversationId);
    } else {
      appendItems(conversationId, [userItem, ...notes]);
    }

    setDraft("");
    if (text) {
      void runBaba(conversationId, active?.sessionId, (sid, options) => streamBaba({ sessionId: sid, text }, options));
    }
  }

  /** "Continue" on a conversation paused at its spending cap. */
  function continueAfterCap(itemId: string) {
    if (!active?.sessionId || working) return;
    const sessionId = active.sessionId;
    // Keep updating the progress block of the task that was paused
    const pausedProgress = [...active.items].reverse().find((i) => i.type === "progress");
    updateConversation(active.id, (c) => ({
      ...c,
      paused: false,
      items: c.items.map((i) => {
        if (i.id === itemId && i.type === "budget_paused") return { ...i, status: "resumed" };
        if (i.id === pausedProgress?.id && i.type === "progress") {
          return {
            ...i,
            title: "Working on it",
            steps: i.steps.map((st) => (st.status === "pending" ? { ...st, status: "running" as const } : st)),
          };
        }
        return i;
      }),
    }));
    void runBaba(active.id, sessionId, (_sid, options) => resumeBaba(sessionId, options), pausedProgress?.id);
  }

  async function decideTool(itemId: string, toolUseId: string, allow: boolean) {
    if (!active?.sessionId) throw new Error("This conversation isn't connected to Baba.");
    await confirmBabaTool(active.sessionId, toolUseId, allow);
    updateItem(itemId, { status: allow ? "approved" : "rejected" });
  }

  function retry() {
    if (!active || working) return;
    const lastUser = [...active.items].reverse().find((i) => i.type === "user");
    if (active.paused || !lastUser || lastUser.type !== "user" || !lastUser.text) return;
    const text = lastUser.text;
    void runBaba(active.id, active.sessionId, (sid, options) => streamBaba({ sessionId: sid, text }, options));
  }

  // ---- Navigation between conversations ----

  function selectConversation(id: string) {
    stop();
    setActiveId(id);
    setConversationsSheetOpen(false);
  }

  function startNewChat() {
    stop();
    setActiveId(null);
    setDraft("");
    setConversationsSheetOpen(false);
    // Wait for the new-chat screen to render, then focus its message box
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  function deleteActive() {
    if (!activeId) return;
    stop();
    setConversations((prev) => prev.filter((c) => c.id !== activeId));
    setActiveId(null);
  }

  function toggleTaskPanel() {
    if (window.matchMedia(WIDE_SCREEN_QUERY).matches) setTaskPanelOpen((v) => !v);
    else setTaskSheetOpen(true);
  }

  function pickSuggestion(prompt: string) {
    setDraft(prompt);
    textareaRef.current?.focus();
  }

  const composer = (size: "normal" | "large") => (
    <Composer
      value={draft}
      onChange={setDraft}
      onSend={send}
      onStop={stop}
      working={working}
      size={size}
      textareaRef={textareaRef}
    />
  );

  const conversationList = (
    <ConversationList
      conversations={conversations}
      activeId={activeId}
      onSelect={selectConversation}
      onNewChat={startNewChat}
    />
  );

  return (
    <div className="flex h-full min-h-0 w-full">
      {/* Conversations column (large screens) */}
      <aside aria-label="Conversations" className="hidden w-72 shrink-0 border-r border-border bg-surface lg:block">
        {conversationList}
      </aside>

      {/* Chat */}
      <section className="flex min-w-0 flex-1 flex-col">
        <ChatHeader
          key={active?.id ?? "new"}
          title={active?.title ?? "New chat"}
          isSample={active?.isSample}
          hasConversation={Boolean(active)}
          taskPanelOpen={taskPanelOpen}
          onOpenConversations={() => setConversationsSheetOpen(true)}
          onToggleTaskPanel={toggleTaskPanel}
          onRename={(title) => active && updateConversation(active.id, (c) => ({ ...c, title }))}
          onDelete={deleteActive}
        />

        {active ? (
          <>
            <MessageList
              key={active.id}
              items={active.items}
              working={working}
              onUpdateItem={updateItem}
              onToolDecision={decideTool}
              onContinue={continueAfterCap}
              cost={active.cost}
              onRetry={retry}
            />
            <div className="shrink-0 px-4 pb-3 pt-1 lg:px-8">
              <div className="mx-auto max-w-3xl">{composer("normal")}</div>
            </div>
          </>
        ) : (
          <NewChat composer={composer("large")} onPickSuggestion={pickSuggestion} />
        )}
      </section>

      {/* Task details column (wide screens) */}
      {taskPanelOpen && (
        <aside aria-label="Task details" className="hidden w-80 shrink-0 flex-col border-l border-border bg-surface xl:flex">
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
            <h2 className="text-sm font-semibold text-foreground">Task details</h2>
            <button
              type="button"
              onClick={() => setTaskPanelOpen(false)}
              aria-label="Close task details"
              className="flex size-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-raised hover:text-foreground"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <TaskDetails conversation={active} />
          </div>
        </aside>
      )}

      {/* Small-screen sheets */}
      <Sheet open={conversationsSheetOpen} onClose={() => setConversationsSheetOpen(false)} side="left" title="Conversations">
        {conversationList}
      </Sheet>
      <Sheet open={taskSheetOpen} onClose={() => setTaskSheetOpen(false)} side="bottom-on-phone" title="Task details">
        <TaskDetails conversation={active} />
      </Sheet>
    </div>
  );
}
