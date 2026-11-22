"use client";

import { Check, Copy, RotateCcw, ThumbsDown, ThumbsUp } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const actionButton =
  "flex size-8 items-center justify-center rounded-lg text-subtle transition-colors hover:bg-surface-raised hover:text-foreground";

type MessageActionsProps = {
  /** Text copied by the Copy button. */
  copyText: string;
  onRetry?: () => void;
};

/** Copy / Retry / Helpful / Not helpful buttons under Baba's messages. */
export function MessageActions({ copyText, onRetry }: MessageActionsProps) {
  const [copied, setCopied] = useState(false);
  const [rating, setRating] = useState<"up" | "down" | null>(null);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked by the browser; nothing else to do.
    }
  }

  return (
    // Always visible on touch screens, shown on hover/focus on large screens
    <div className="flex items-center gap-1 transition-opacity lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100">
      <button type="button" onClick={handleCopy} aria-label={copied ? "Copied" : "Copy"} className={actionButton}>
        {copied ? <Check aria-hidden="true" className="size-4 text-success" /> : <Copy aria-hidden="true" className="size-4" />}
      </button>
      {onRetry && (
        <button type="button" onClick={onRetry} aria-label="Retry" className={actionButton}>
          <RotateCcw aria-hidden="true" className="size-4" />
        </button>
      )}
      <button
        type="button"
        onClick={() => setRating(rating === "up" ? null : "up")}
        aria-label="Helpful"
        aria-pressed={rating === "up"}
        className={cn(actionButton, rating === "up" && "text-accent")}
      >
        <ThumbsUp aria-hidden="true" className="size-4" />
      </button>
      <button
        type="button"
        onClick={() => setRating(rating === "down" ? null : "down")}
        aria-label="Not helpful"
        aria-pressed={rating === "down"}
        className={cn(actionButton, rating === "down" && "text-danger")}
      >
        <ThumbsDown aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}
