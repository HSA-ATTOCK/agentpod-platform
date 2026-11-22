"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { FieldError } from "./field-error";
import { inputClasses } from "./input";

type PasswordInputProps = Omit<ComponentProps<"input">, "id" | "type"> & {
  id: string;
  label: string;
  error?: string;
  /** Content shown under the input, e.g. a password rules checklist. */
  hint?: ReactNode;
  labelAction?: ReactNode;
};

/** Password field with a show/hide toggle button. */
export function PasswordInput({
  id,
  label,
  error,
  hint,
  labelAction,
  required,
  className,
  ...props
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
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
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          className={cn(inputClasses, "pr-11", error ? "border-danger" : "border-border", className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          aria-controls={id}
          className="absolute right-1 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-subtle transition-colors hover:text-foreground"
        >
          {visible ? (
            <EyeOff aria-hidden="true" className="size-4" />
          ) : (
            <Eye aria-hidden="true" className="size-4" />
          )}
        </button>
      </div>
      {hint && (
        <div id={hintId} className="mt-2.5">
          {hint}
        </div>
      )}
      <FieldError id={errorId} message={error} />
    </div>
  );
}
