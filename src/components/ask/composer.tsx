"use client";

import { ArrowUp, FileText, Paperclip, Square, X } from "lucide-react";
import { useLayoutEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { cn } from "@/lib/utils";
import type { ChatAttachment } from "@/types/chat";

const MAX_LINES = 8;
const LINE_HEIGHT_PX = 20;

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type ComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: (text: string, attachments: ChatAttachment[]) => void;
  onStop: () => void;
  working: boolean;
  /** Bigger box for the new-chat screen. */
  size?: "normal" | "large";
  /** Lets the parent focus the text box (e.g. after picking a suggestion). */
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
};

/** The message box: grows with text, attaches files, sends with Enter. */
export function Composer({
  value,
  onChange,
  onSend,
  onStop,
  working,
  size = "normal",
  textareaRef,
}: ComposerProps) {
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fallbackRef = useRef<HTMLTextAreaElement | null>(null);
  const inputRef = textareaRef ?? fallbackRef;

  const canSend = value.trim().length > 0 || attachments.length > 0;

  // Grow the textarea with its content, up to MAX_LINES
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_LINES * LINE_HEIGHT_PX + 16)}px`;
  }, [value, inputRef]);

  function send() {
    if (!canSend || working) return;
    onSend(value.trim(), attachments);
    setAttachments([]);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send();
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files) return;
    const added = Array.from(files).map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      sizeLabel: formatSize(file.size),
    }));
    setAttachments((prev) => [...prev, ...added]);
  }

  return (
    <div className="w-full">
      <div
        className={cn(
          "rounded-card border border-border bg-surface-raised shadow-lg transition-colors focus-within:border-border-strong",
          size === "large" ? "p-4" : "p-2.5",
        )}
      >
        {attachments.length > 0 && (
          <ul className="mb-2 flex flex-wrap gap-1.5 px-1 pt-1" aria-label="Files to send">
            {attachments.map((file) => (
              <li
                key={file.id}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface py-1 pl-2.5 pr-1 text-xs text-foreground"
              >
                <FileText aria-hidden="true" className="size-3.5 text-accent" />
                <span className="max-w-40 truncate">{file.name}</span>
                {file.sizeLabel && <span className="text-subtle">{file.sizeLabel}</span>}
                <button
                  type="button"
                  onClick={() => setAttachments((prev) => prev.filter((f) => f.id !== file.id))}
                  aria-label={`Remove ${file.name}`}
                  className="flex size-6 items-center justify-center rounded text-subtle hover:text-danger"
                >
                  <X aria-hidden="true" className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Attach files"
            className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
          >
            <Paperclip aria-hidden="true" className="size-5" />
          </button>

          <label htmlFor="composer-input" className="sr-only">
            Message Baba
          </label>
          <textarea
            id="composer-input"
            ref={inputRef}
            rows={1}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Baba to do anything…"
            className={cn(
              "min-w-0 flex-1 resize-none bg-transparent py-2 leading-5 text-foreground placeholder:text-subtle focus:outline-none focus-visible:outline-none",
              size === "large" ? "text-base" : "text-sm",
            )}
          />

          {working ? (
            <button
              type="button"
              onClick={onStop}
              aria-label="Stop"
              className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border-strong bg-surface text-foreground transition-colors hover:bg-surface-hover"
            >
              <Square aria-hidden="true" className="size-3.5 fill-current" />
            </button>
          ) : (
            <button
              type="button"
              onClick={send}
              disabled={!canSend}
              aria-label="Send message"
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ArrowUp aria-hidden="true" className="size-5" />
            </button>
          )}
        </div>
      </div>
      <p className="mt-2 text-center text-[11px] text-subtle">
        Baba can make mistakes. Sensitive actions always need your approval.
      </p>
    </div>
  );
}
