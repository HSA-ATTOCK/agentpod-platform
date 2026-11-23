"use client";

import { useSearchParams } from "next/navigation";
import { Alert } from "@/components/ui/alert";

/** Shows why an email or Google link didn't work (sent back from /auth/callback as ?error=). */
export function AuthCallbackError() {
  const error = useSearchParams().get("error");
  if (!error) return null;
  return (
    <Alert variant="error" className="mb-4">
      {error.slice(0, 200)}
    </Alert>
  );
}
