import { CircleAlert } from "lucide-react";

/** Red helper text shown under a form field. */
export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1.5 flex items-center gap-1 text-xs text-danger">
      <CircleAlert aria-hidden="true" className="size-3.5 shrink-0" />
      <span>{message}</span>
    </p>
  );
}
