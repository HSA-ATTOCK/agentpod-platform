"use client";

import { Ellipsis, MessagesSquare, PanelRight, Pencil, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";

type ChatHeaderProps = {
  title: string;
  isSample?: boolean;
  /** False for a brand-new chat (no rename/delete menu). */
  hasConversation: boolean;
  taskPanelOpen: boolean;
  onOpenConversations: () => void;
  onToggleTaskPanel: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
};

const iconButton =
  "flex size-10 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-raised hover:text-foreground";

/** Title row above the messages, with conversation menu and Task details toggle. */
export function ChatHeader({
  title,
  isSample,
  hasConversation,
  taskPanelOpen,
  onOpenConversations,
  onToggleTaskPanel,
  onRename,
  onDelete,
}: ChatHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // Close the menu on outside click or Escape
  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  function finishRename(save: boolean) {
    if (save && draftTitle.trim()) onRename(draftTitle.trim());
    setRenaming(false);
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border px-2 sm:px-4">
      <div className="flex min-w-0 items-center gap-1">
        <button type="button" onClick={onOpenConversations} aria-label="Open conversations" className={`${iconButton} lg:hidden`}>
          <MessagesSquare aria-hidden="true" className="size-5" />
        </button>

        {renaming ? (
          <>
            <label htmlFor="rename-conversation" className="sr-only">
              Conversation name
            </label>
            <input
              id="rename-conversation"
              autoFocus
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              onBlur={() => finishRename(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter") finishRename(true);
                if (e.key === "Escape") finishRename(false);
              }}
              className="h-9 min-w-0 rounded-control border border-accent bg-surface-raised px-2.5 text-sm text-foreground focus:outline-none"
            />
          </>
        ) : (
          <h1 className="truncate px-1 text-sm font-semibold text-foreground sm:text-base">{title}</h1>
        )}

        {isSample && <Badge tone="info" className="hidden text-[11px] sm:inline-flex">Sample</Badge>}

        {hasConversation && !renaming && (
          <div ref={menuRef} className="relative">
            <button
              ref={menuButtonRef}
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Conversation options"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className={iconButton}
            >
              <Ellipsis aria-hidden="true" className="size-5" />
            </button>
            {menuOpen && (
              <div role="menu" className="absolute left-0 top-full z-30 mt-1 w-40 rounded-xl border border-border bg-surface-raised p-1 shadow-xl">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    setDraftTitle(title);
                    setRenaming(true);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-surface-hover"
                >
                  <Pencil aria-hidden="true" className="size-4" />
                  Rename
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete();
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-danger hover:bg-danger/10"
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                  Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onToggleTaskPanel}
        aria-expanded={taskPanelOpen}
        className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 text-xs font-medium text-muted transition-colors hover:bg-surface-raised hover:text-foreground"
      >
        <PanelRight aria-hidden="true" className="size-4" />
        <span className="hidden sm:inline">Task details</span>
        <span className="sr-only sm:hidden">Task details</span>
      </button>
    </header>
  );
}
