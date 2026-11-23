"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
import {
  createConversation,
  deleteConversation,
  listRecentConversations,
  loadConversationItems,
  renameConversation,
  saveConversationItems,
} from "@/lib/data/chat-store";
import type { ChatAttachment, ChatItem, Conversation } from "@/types/chat";
import { ChatHeader } from "./chat-header";
import { Composer } from "./composer";
import { ConversationList } from "./conversation-list";
import { MessageList } from "./message-list";
import { NewChat } from "./new-chat";
import { TaskDetails } from "./task-details";

// How many times to reconnect automatically if the connection drops mid-task
const MAX_RECONNECTS = 5;

// Wait this long after the last change before saving a conversation's messages
const SAVE_DELAY_MS = 800;

// The Task details panel sits beside the chat from this width; below it, it opens as a sheet.
const WIDE_SCREEN_QUERY = "(min-width: 1280px)";

function titleFrom(text: string, attachments: ChatAttachment[]) {
  const source = text || attachments[0]?.name || "New chat";
  return source.length > 48 ? `${source.slice(0, 47)}…` : source;
}

type AskBabaProps = {
  /** The workspace's recent conversations (messages load when one is opened). */
  initialConversations: Conversation[];
  workspaceId: string;
  userId: string;
  /** Viewers can read conversations but not give Baba tasks. */
  canWrite: boolean;
  /** Owners and admins can connect tools from the chat. */
  canManage: boolean;
  /** Open this conversation straight away (from ?c= links on other pages). */
  initialActiveId?: string;
  /** Pre-filled message (from a workflow's "Run now"). */
  initialPrompt?: string;
  /** The workflow being run, so its task is linked to it. */
  workflowId?: string;
};

/**
 * The Ask Baba screen. Holds the conversations and the chat state on the client.
 * Messages go to our /api/baba routes, which talk to Claude Managed Agents.
 * Conversations and their messages are saved to the database as they change.
 */
export function AskBaba({
  initialConversations,
  workspaceId,
  userId,
  canWrite,
  canManage,
  initialActiveId,
  initialPrompt,
  workflowId,
}: AskBabaProps) {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
  const [activeId, setActiveId] = useState<string | null>(
    initialActiveId && initialConversations.some((c) => c.id === initialActiveId) ? initialActiveId : null,
  );
  const [draft, setDraft] = useState(initialPrompt ?? "");
  // Only the first message after "Run now" belongs to the workflow
  const workflowRef = useRef(workflowId);
  const [working, setWorking] = useState(false);

  const [taskPanelOpen, setTaskPanelOpen] = useState(true); // wide screens
  const [taskSheetOpen, setTaskSheetOpen] = useState(false); // small screens
  const [conversationsSheetOpen, setConversationsSheetOpen] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const runningConversationRef = useRef<string | undefined>(undefined);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const active = conversations.find((c) => c.id === activeId) ?? null;

  // ---- Keeping the list fresh ----
  // Conversations can be created elsewhere (scheduled workflows, teammates, other tabs):
  // re-check every 30 seconds and whenever this tab comes back into view.
  const activeRef = useRef(activeId);
  useEffect(() => {
    activeRef.current = activeId;
  }, [activeId]);
  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      if (document.visibilityState !== "visible") return;
      let latest: Conversation[];
      try {
        latest = await listRecentConversations(workspaceId);
      } catch {
        return; // offline for a moment; try again next time
      }
      if (cancelled) return;
      setConversations((prev) => {
        const byId = new Map(prev.map((c) => [c.id, c]));
        const merged = latest.map((fresh) => {
          const mine = byId.get(fresh.id);
          if (!mine) return fresh;
          // The open conversation (or one with unsaved local changes) keeps what's on screen
          if (mine.id === activeRef.current || !mine.loaded) return { ...mine, title: fresh.title, updatedAt: mine.updatedAt > fresh.updatedAt ? mine.updatedAt : fresh.updatedAt, cost: fresh.cost ?? mine.cost, paused: fresh.paused };
          // Changed elsewhere since we loaded it: reload its messages when it's next opened
          return fresh.updatedAt > mine.updatedAt ? fresh : mine;
        });
        const freshIds = new Set(latest.map((c) => c.id));
        // Keep local conversations the server didn't return (brand new, or older than the latest 50)
        const extra = prev.filter((c) => !freshIds.has(c.id));
        return [...merged, ...extra].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      });
    }
    const timer = setInterval(() => void refresh(), 30_000);
    const onVisible = () => void refresh();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [workspaceId]);

  // ---- Saving to the database ----

  // What was last saved for each item (by item id), so only changes are sent
  const savedRef = useRef(new Map<string, string>());
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      for (const c of conversations) {
        if (!c.loaded) continue;
        const changed = c.items.filter((item) => savedRef.current.get(item.id) !== JSON.stringify(item));
        if (changed.length === 0) continue;
        const snapshot = changed.map((item) => [item.id, JSON.stringify(item)] as const);
        saveConversationItems(c.id, workspaceId, changed)
          .then(() => {
            snapshot.forEach(([id, json]) => savedRef.current.set(id, json));
            setSaveError(false);
          })
          .catch((error) => {
            console.error("Saving the conversation failed", error);
            setSaveError(true);
          });
      }
    }, SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [conversations, workspaceId]);

  /** Marks items as already saved (they just came from the database). */
  function rememberSaved(items: ChatItem[]) {
    items.forEach((item) => savedRef.current.set(item.id, JSON.stringify(item)));
  }

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
      if (runningConversationRef.current) void interruptBaba(runningConversationRef.current);
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
    open: (options: StreamOptions) => Promise<void>,
    /** Continue an existing progress block (after "Continue") instead of starting a new one. */
    existingProgressId?: string,
  ) {
    const controller = new AbortController();
    abortRef.current = controller;
    runningConversationRef.current = conversationId;
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
        case "connect_request":
        case "google_app_request":
        case "key_request": {
          const itemId = `${event.type}-${event.id}`;
          const item: ChatItem =
            event.type === "connect_request"
              ? { id: itemId, type: "connect_request", service: event.service, reason: event.reason, status: "pending" }
              : event.type === "google_app_request"
                ? { id: itemId, type: "google_app_request", redirectUri: event.redirectUri, reason: event.reason, status: "pending" }
                : {
                  id: itemId,
                  type: "key_request",
                  serviceName: event.serviceName,
                  apiHost: event.apiHost,
                  headerName: event.headerName,
                  headerPrefix: event.headerPrefix,
                  queryParam: event.queryParam,
                  instructions: event.instructions,
                  status: "pending",
                };
          updateConversation(conversationId, (c) => (c.items.some((i) => i.id === itemId) ? c : { ...c, items: [...c.items, item] }));
          break;
        }
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
                  downloadUrl: fileDownloadUrl(f.id, conversationId),
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
        await open(options);
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
          await watchBaba(conversationId, options);
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

  async function send(text: string, attachments: ChatAttachment[]) {
    if (!canWrite) return;
    // What's saved in the chat: name and size only
    const userItem: ChatItem = {
      id: crypto.randomUUID(),
      type: "user",
      text,
      attachments: attachments.map(({ id, name, sizeLabel }) => ({ id, name, sizeLabel })),
    };
    const files = attachments.flatMap((a) =>
      a.upload ? [{ fileId: a.upload.fileId, token: a.upload.token, name: a.name, mimeType: a.upload.mimeType }] : [],
    );
    const notes: ChatItem[] = [];
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

    setDraft("");

    if (!conversationId) {
      const id = crypto.randomUUID();
      conversationId = id;
      const conversation: Conversation = {
        id,
        title: titleFrom(text, attachments),
        updatedAt: new Date().toISOString(),
        tools: [],
        items: [userItem, ...notes],
        loaded: false, // saved once the database row exists
      };
      setConversations((prev) => [conversation, ...prev]);
      setActiveId(id);
      try {
        await createConversation({ id, workspaceId, userId, title: conversation.title });
        updateConversation(id, (c) => ({ ...c, loaded: true }));
      } catch (error) {
        appendItems(id, [
          { id: crypto.randomUUID(), type: "error", text: error instanceof Error ? error.message : String(error) },
        ]);
        return;
      }
    } else {
      appendItems(conversationId, [userItem, ...notes]);
    }

    if (text || files.length > 0) {
      const id = conversationId;
      const workflow = workflowRef.current;
      workflowRef.current = undefined;
      void runBaba(id, active?.sessionId, (options) =>
        streamBaba({ conversationId: id, text, workflowId: workflow, attachments: files }, options),
      );
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
    const id = active.id;
    void runBaba(id, sessionId, (options) => resumeBaba(id, options), pausedProgress?.id);
  }

  async function decideTool(itemId: string, toolUseId: string, allow: boolean) {
    if (!active?.sessionId) throw new Error("This conversation isn't connected to Baba.");
    await confirmBabaTool(active.id, toolUseId, allow);
    updateItem(itemId, { status: allow ? "approved" : "rejected" });
    // An approved change (workspace name, team, settings…) may show elsewhere on screen
    if (allow) router.refresh();
    // Nothing is listening (e.g. a scheduled run waiting for this OK, or the page was reloaded):
    // follow Baba as it carries on
    if (!working) {
      const id = active.id;
      const progress = [...active.items].reverse().find((i) => i.type === "progress");
      void runBaba(id, active.sessionId, (options) => watchBaba(id, options), progress?.id);
    }
  }

  function retry() {
    if (!active || working) return;
    const lastUser = [...active.items].reverse().find((i) => i.type === "user");
    if (active.paused || !lastUser || lastUser.type !== "user" || !lastUser.text) return;
    const text = lastUser.text;
    const id = active.id;
    void runBaba(id, active.sessionId, (options) => streamBaba({ conversationId: id, text }, options));
  }

  // ---- Navigation between conversations ----

  function loadIfNeeded(id: string) {
    const conversation = conversations.find((c) => c.id === id);
    if (conversation && !conversation.loaded) {
      loadConversationItems(id)
        .then((items) => {
          rememberSaved(items);
          updateConversation(id, (c) => ({ ...c, items: [...items, ...c.items], loaded: true }));
        })
        .catch((error) => {
          updateConversation(id, (c) => ({
            ...c,
            items: [{ id: `load-error-${id}`, type: "error", text: error instanceof Error ? error.message : String(error) }],
          }));
        });
    }
  }

  function selectConversation(id: string) {
    stop();
    setActiveId(id);
    setConversationsSheetOpen(false);
    loadIfNeeded(id);
  }

  // A ?c= link opened this conversation: fetch its messages once
  const initialLoad = useRef(activeId);
  useEffect(() => {
    if (initialLoad.current) loadIfNeeded(initialLoad.current);
    initialLoad.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

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
    const id = activeId;
    stop();
    setConversations((prev) => prev.filter((c) => c.id !== id));
    setActiveId(null);
    deleteConversation(id).catch((error) => {
      console.error(error);
      setSaveError(true);
    });
  }

  function renameActive(title: string) {
    if (!active) return;
    const id = active.id;
    updateConversation(id, (c) => ({ ...c, title }));
    renameConversation(id, title).catch((error) => {
      console.error(error);
      setSaveError(true);
    });
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
    <>
      {!canWrite ? (
        <p className="rounded-card border border-border bg-surface p-4 text-center text-sm text-muted">
          You have view-only access to this workspace, so you can read conversations but not give Baba tasks.
        </p>
      ) : (
        <Composer
          value={draft}
          onChange={setDraft}
          onSend={send}
          onStop={stop}
          working={working}
          size={size}
          textareaRef={textareaRef}
        />
      )}
      {saveError && (
        <p role="status" className="mt-2 text-center text-xs text-warning">
          Some changes couldn&apos;t be saved. Check your connection; it will retry with your next change.
        </p>
      )}
    </>
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
          onRename={renameActive}
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
              canManage={canManage}
              conversationId={active.id}
              onSend={(text) => void send(text, [])}
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
