"use client";

import { cn } from "@/lib/utils";

type SwitchProps = {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  /** Accessible name, e.g. "Turn on Weekly report". */
  label: string;
  disabled?: boolean;
};

/** An on/off toggle. */
export function Switch({ checked, onChange, label, disabled }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors disabled:cursor-not-allowed",
        checked ? "border-accent bg-accent" : "border-border-strong bg-surface-raised",
        disabled && "opacity-70",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "inline-block size-4 rounded-full transition-transform",
          checked ? "translate-x-[22px] bg-accent-foreground" : "translate-x-1 bg-muted",
        )}
      />
    </button>
  );
}
