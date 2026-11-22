"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type SheetSide = "left" | "right" | "wide-right" | "bottom-on-phone" | "center";

const sideClasses: Record<SheetSide, string> = {
  left: "inset-y-0 left-0 w-full sm:w-80 border-r",
  right: "inset-y-0 right-0 w-full sm:w-96 border-l",
  "wide-right": "inset-y-0 right-0 w-full sm:w-[480px] border-l",
  // A centred dialog
  center:
    "left-1/2 top-1/2 max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-card border",
  // Bottom sheet on phones, right-side panel from the "sm" breakpoint up
  "bottom-on-phone":
    "inset-x-0 bottom-0 max-h-[85dvh] rounded-t-2xl border-t sm:inset-x-auto sm:inset-y-0 sm:right-0 sm:max-h-none sm:w-96 sm:rounded-none sm:border-l sm:border-t-0",
};

type SheetProps = {
  open: boolean;
  onClose: () => void;
  side: SheetSide;
  title: string;
  children: ReactNode;
  /** Sticky area under the content, e.g. Save / Cancel buttons. */
  footer?: ReactNode;
};

/**
 * Overlay panel (drawer / bottom sheet) for small screens.
 * Escape or tapping the backdrop closes it, and focus returns to whatever opened it.
 */
export function Sheet({ open, onClose, side, title, children, footer }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onCloseRef.current();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 bg-background/70 backdrop-blur-sm"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          "absolute flex flex-col overflow-hidden border-border bg-surface shadow-2xl focus:outline-none",
          sideClasses[side],
        )}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={`Close ${title.toLowerCase()}`}
            className="flex size-10 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-raised hover:text-foreground"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer && (
          <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-border px-4 py-3">{footer}</div>
        )}
      </div>
    </div>
  );
}
