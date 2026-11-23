"use client";

import { Loader2, MessageSquare, Plus, Search } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { LocalTime } from "@/components/ui/local-time";
import { cn } from "@/lib/utils";
import type { Conversation } from "@/types/chat";

const DAY_MS = 24 * 60 * 60 * 1000;

/** "Today" / "Yesterday" / "Previous 7 days" / "Older" (UTC days, so server and browser agree). */
function groupLabel(iso: string) {
  const dayKey = (d: Date) => d.toISOString().slice(0, 10);
  const date = new Date(iso);
  const now = new Date();
  if (dayKey(date) >= dayKey(now)) return "Today";
  if (dayKey(date) === dayKey(new Date(now.getTime() - DAY_MS))) return "Yesterday";
  if (now.getTime() - date.getTime() < 7 * DAY_MS) return "Previous 7 days";
  return "Older";
}


type ConversationListProps = {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  /** Conversations with a task still running (shown with a spinner). */
  runningIds?: ReadonlySet<string>;
};

/** "New chat" button, search box and grouped list of past conversations. */
export function ConversationList({ conversations, activeId, onSelect, onNewChat, runningIds }: ConversationListProps) {
  const [query, setQuery] = useState("");
  const searchId = useId();

  const filtered = conversations
    .filter((c) => c.title.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const groups = new Map<string, Conversation[]>();
  for (const conversation of filtered) {
    const label = groupLabel(conversation.updatedAt);
    groups.set(label, [...(groups.get(label) ?? []), conversation]);
  }

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <Button fullWidth onClick={onNewChat}>
        <Plus aria-hidden="true" className="size-4" />
        New chat
      </Button>

      <div className="relative">
        <label htmlFor={searchId} className="sr-only">
          Search conversations
        </label>
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
        <input
          id={searchId}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search conversations…"
          className="h-10 w-full rounded-control border border-border bg-surface-raised pl-9 pr-3 text-sm text-foreground placeholder:text-subtle focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      <nav aria-label="Conversations" className="relative -mx-1 min-h-0 flex-1 space-y-5 overflow-y-auto px-1">
        {filtered.length === 0 && <p className="px-2 text-sm text-subtle">No conversations found.</p>}
        {[...groups.entries()].map(([label, items]) => (
          <div key={label}>
            <h3 className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-wider text-subtle">{label}</h3>
            <ul className="space-y-0.5">
              {items.map((conversation) => {
                const active = conversation.id === activeId;
                return (
                  <li key={conversation.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(conversation.id)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
                        active ? "bg-surface-hover text-foreground" : "text-muted hover:bg-surface-raised hover:text-foreground",
                      )}
                    >
                      {runningIds?.has(conversation.id) ? (
                        <Loader2 aria-label="Working" className="size-4 shrink-0 animate-spin text-accent" />
                      ) : (
                        <MessageSquare aria-hidden="true" className={cn("size-4 shrink-0", active ? "text-accent" : "text-subtle")} />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{conversation.title}</span>
                        <LocalTime iso={conversation.updatedAt} format={groupLabel(conversation.updatedAt) === "Today" ? "time" : "date"} className="block text-[11px] text-subtle" />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </div>
  );
}
