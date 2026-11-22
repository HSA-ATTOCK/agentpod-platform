import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { FieldError } from "./field-error";

export const inputClasses =
  "h-10 w-full rounded-control border bg-surface-raised px-3.5 text-sm text-foreground placeholder:text-subtle transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

type InputProps = Omit<ComponentProps<"input">, "id"> & {
  id: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  /** Extra content on the right of the label row, e.g. a "Forgot password?" link. */
  labelAction?: ReactNode;
};

/** Text input with a label, optional hint and error message, all wired up for screen readers. */
export function Input({
  id,
  label,
  error,
  hint,
  labelAction,
  required,
  className,
  ...props
}: InputProps) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [hint ? hintId : null, error ? errorId : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label htmlFor={id} className="block text-xs font-semibold text-muted">
          {label}
          {required && (
            <span aria-hidden="true" className="text-danger">
              {" "}
              *
            </span>
          )}
        </label>
        {labelAction}
      </div>
      <input
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={cn(inputClasses, error ? "border-danger" : "border-border", className)}
        {...props}
      />
      {hint && (
        <div id={hintId} className="mt-1.5 text-xs text-subtle">
          {hint}
        </div>
      )}
      <FieldError id={errorId} message={error} />
    </div>
  );
}
