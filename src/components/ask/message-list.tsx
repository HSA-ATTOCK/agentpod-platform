"use client";

import { ArrowDown } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { itemToPlainText } from "@/lib/chat-meta";
import type { ChatItem } from "@/types/chat";
import { ApprovalCard } from "./approval-card";
import { BabaRow } from "./baba-avatar";
import { BudgetPausedCard } from "./budget-paused-card";
import {
  AnswerView,
  ErrorMessage,
  FileCard,
  ProgressBlock,
  SourcesRow,
  TextReply,
  ThinkingIndicator,
  UserMessage,
} from "./chat-items";
import { ConnectRequestCard, GoogleAppCard, KeyRequestCard } from "./connect-cards";
import { MarkdownReply } from "./markdown-reply";
import { MessageActions } from "./message-actions";
import { ToolApprovalCard } from "./tool-approval-card";

type MessageListProps = {
  items: ChatItem[];
  working: boolean;
  onUpdateItem: (itemId: string, patch: Partial<ChatItem>) => void;
  onToolDecision: (itemId: string, toolUseId: string, allow: boolean) => Promise<void>;
  onContinue: (itemId: string) => void;
  /** Spend so far, shown on the "paused at cap" card. */
  cost?: { cents: number; capCents: number | null };
  onRetry: () => void;
  /** For the Connect / API-key cards Baba can put in the chat. */
  canManage: boolean;
  conversationId: string;
  onSend: (text: string) => void;
};

type Handlers = Pick<
  MessageListProps,
  "onUpdateItem" | "onToolDecision" | "onContinue" | "cost" | "working" | "canManage" | "conversationId" | "onSend"
>;

// Item types that get Copy / Retry / Helpful buttons underneath
const WITH_ACTIONS = new Set<ChatItem["type"]>(["progress", "answer", "text", "markdown"]);
// Item types that sit under the previous Baba message without their own avatar
const NO_AVATAR = new Set<ChatItem["type"]>(["sources", "file"]);

function renderItem(
  item: ChatItem,
  { onUpdateItem, onToolDecision, onContinue, cost, working, canManage, conversationId, onSend }: Handlers,
): ReactNode {
  const cardProps = { canManage, conversationId, onSend, busy: working, onUpdate: (patch: Partial<ChatItem>) => onUpdateItem(item.id, patch) };
  switch (item.type) {
    case "progress":
      return <ProgressBlock item={item} />;
    case "sources":
      return <SourcesRow item={item} />;
    case "answer":
      return <AnswerView item={item} />;
    case "file":
      return <FileCard item={item} />;
    case "approval":
      return <ApprovalCard item={item} onChange={(patch) => onUpdateItem(item.id, patch)} />;
    case "error":
      return <ErrorMessage item={item} />;
    case "text":
      return <TextReply item={item} />;
    case "markdown":
      return <MarkdownReply text={item.text} />;
    case "tool_approval":
      return (
        <ToolApprovalCard item={item} onDecide={(allow) => onToolDecision(item.id, item.toolUseId, allow)} />
      );
    case "connect_request":
      return <ConnectRequestCard item={item} {...cardProps} />;
    case "key_request":
      return <KeyRequestCard item={item} {...cardProps} />;
    case "google_app_request":
      return <GoogleAppCard item={item} {...cardProps} />;
    case "budget_paused":
      return <BudgetPausedCard item={item} cost={cost} busy={working} onContinue={() => onContinue(item.id)} />;
    case "user":
      return null;
  }
}

/** Scrollable list of chat items with a "Jump to latest" button. */
export function MessageList({
  items,
  working,
  onUpdateItem,
  onToolDecision,
  onContinue,
  cost,
  onRetry,
  canManage,
  conversationId,
  onSend,
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const [showJump, setShowJump] = useState(false);

  function scrollToBottom(behavior: ScrollBehavior = "smooth") {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior });
  }

  // Start at the latest message
  useEffect(() => {
    scrollToBottom("auto");
  }, []);

  // Follow new messages, unless the user has scrolled up to read
  useEffect(() => {
    if (nearBottomRef.current) scrollToBottom();
  }, [items.length, working]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    nearBottomRef.current = nearBottom;
    setShowJump(!nearBottom);
  }

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        role="log"
        aria-live="polite"
        aria-label="Conversation"
        className="h-full overflow-y-auto px-4 py-6 lg:px-8"
      >
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
          {items.map((item, index) => {
            if (item.type === "user") return <UserMessage key={item.id} item={item} />;
            const previous = items[index - 1];
            const showAvatar = !NO_AVATAR.has(item.type) || previous?.type === "user";
            return (
              <BabaRow key={item.id} showAvatar={showAvatar} className="group">
                {renderItem(item, { onUpdateItem, onToolDecision, onContinue, cost, working, canManage, conversationId, onSend })}
                {WITH_ACTIONS.has(item.type) && (
                  <MessageActions copyText={itemToPlainText(item)} onRetry={onRetry} />
                )}
              </BabaRow>
            );
          })}
          {working && (
            <BabaRow>
              <ThinkingIndicator />
            </BabaRow>
          )}
        </div>
      </div>

      {showJump && (
        <button
          type="button"
          onClick={() => scrollToBottom()}
          aria-label="Jump to latest message"
          className="absolute bottom-4 right-4 flex size-10 items-center justify-center rounded-full border border-border bg-surface-raised text-foreground shadow-xl transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <ArrowDown aria-hidden="true" className="size-5" />
        </button>
      )}
    </div>
  );
}
