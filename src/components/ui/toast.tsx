"use client";

import { CircleCheck } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A small confirmation message in the bottom corner.
 * Usage: const { toast, showToast } = useToast(); … {toast} … showToast("Saved")
 */
export function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((text: string) => {
    if (timer.current) clearTimeout(timer.current);
    setMessage(text);
    timer.current = setTimeout(() => setMessage(null), 3200);
  }, []);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const toast = (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-[60] flex justify-center sm:inset-x-auto sm:right-6 sm:justify-end lg:bottom-6"
    >
      {message && (
        <div className="flex items-center gap-2.5 rounded-xl border border-border bg-surface-raised px-4 py-3 text-sm text-foreground shadow-2xl">
          <CircleCheck aria-hidden="true" className="size-4 shrink-0 text-accent" />
          {message}
        </div>
      )}
    </div>
  );

  return { toast, showToast };
}
