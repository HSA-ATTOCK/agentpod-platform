"use client";

import { cn } from "@/lib/utils";

type FilterTabsProps<T extends string> = {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
};

/** A row of pill buttons for filtering a list. Scrolls sideways on small screens. */
export function FilterTabs<T extends string>({ label, options, value, onChange }: FilterTabsProps<T>) {
  return (
    <div role="group" aria-label={label} className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "h-9 shrink-0 whitespace-nowrap rounded-control border px-3 text-xs font-medium transition-colors",
            value === option.value
              ? "border-border-strong bg-surface-raised text-foreground"
              : "border-transparent text-muted hover:bg-surface-raised hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
